import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../server/db";
import { storage } from "../server/storage";
import { isSavedStateCompatible, type SavedScorerIdentity } from "../shared/scoring-integrity";
import { ScoringConflictError } from "../server/scoring-integrity";

const EXPECTED_BRANCH_ID = "br-weathered-feather-abr2c9zx";
const BASE_URL = "http://127.0.0.1:5000";
const runId = `stage1-db-${Date.now()}-${randomUUID().slice(0, 8)}`;

type DbMatch = {
  id: number;
  tournament_id: number;
  player_a_id: number | null;
  player_b_id: number | null;
  score_a: number;
  score_b: number;
  best_of: number;
  status: string;
  winner_id: number | null;
  scoring_version: number;
};

type CaseReport = {
  name: string;
  setup: string;
  sequence: string[];
  expected: string;
  actual: string;
  databaseState: string;
  result: "PASS" | "FAIL";
};

const reports: CaseReport[] = [];
let testUserId: number | null = null;
let playerCounter = 0;
let matchCounter = 0;

async function query<T = any>(text: string, values: unknown[] = []): Promise<T[]> {
  return (await pool.query(text, values)).rows as T[];
}

async function createTournament(label: string, settings: Record<string, unknown> = {}): Promise<number> {
  assert.ok(testUserId);
  const [row] = await query<{ id: number }>(
    `INSERT INTO tournaments (user_id, name, type, status, settings, is_legacy)
     VALUES ($1, $2, 'KNOCKOUT', 'IN_PROGRESS', $3::jsonb, false)
     RETURNING id`,
    [testUserId, `${runId}-${label}`, JSON.stringify(settings)],
  );
  return row.id;
}

async function createPlayer(tournamentId: number, suffix: string): Promise<number> {
  playerCounter += 1;
  const [row] = await query<{ id: number }>(
    `INSERT INTO players (tournament_id, name) VALUES ($1, $2) RETURNING id`,
    [tournamentId, `${runId}-${suffix}-${playerCounter}`],
  );
  return row.id;
}

async function createMatch(options: {
  tournamentId: number;
  playerAId: number;
  playerBId: number;
  scoreA?: number;
  scoreB?: number;
  bestOf?: number;
  status?: string;
  scoringVersion?: number;
  roundKey?: string;
  order?: number;
  boardNumber?: number | null;
}): Promise<number> {
  matchCounter += 1;
  const [row] = await query<{ id: number }>(
    `INSERT INTO matches (
       tournament_id, stage, round_key, player_a_id, player_b_id,
       score_a, score_b, best_of, status, "order", board_number, scoring_version
     ) VALUES ($1, 'KNOCKOUT', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      options.tournamentId,
      options.roundKey ?? `TEST_${matchCounter}`,
      options.playerAId,
      options.playerBId,
      options.scoreA ?? 0,
      options.scoreB ?? 0,
      options.bestOf ?? 5,
      options.status ?? "IN_PROGRESS",
      options.order ?? matchCounter,
      options.boardNumber ?? 1,
      options.scoringVersion ?? 0,
    ],
  );
  return row.id;
}

async function createBoardAccess(tournamentId: number, boardNumber: number): Promise<string> {
  const accessToken = `${runId}-access-${randomUUID()}`;
  await query(
    `INSERT INTO board_sessions (
       tournament_id, board_number, pairing_token, access_token, paired_at, expires_at
     ) VALUES ($1, $2, $3, $4, now(), now() + interval '1 hour')`,
    [tournamentId, boardNumber, `${runId}-pair-${randomUUID()}`, accessToken],
  );
  return accessToken;
}

async function getMatch(matchId: number): Promise<DbMatch> {
  const [row] = await query<DbMatch>(
    `SELECT id, tournament_id, player_a_id, player_b_id, score_a, score_b,
            best_of, status, winner_id, scoring_version
       FROM matches WHERE id = $1`,
    [matchId],
  );
  assert.ok(row, `match ${matchId} should exist`);
  return row;
}

async function getHistory(matchId: number): Promise<unknown[]> {
  const [row] = await query<{ leg_history: unknown[] | null }>(
    `SELECT leg_history FROM match_notes WHERE match_id = $1`,
    [matchId],
  );
  return Array.isArray(row?.leg_history) ? row.leg_history : [];
}

async function getSubmission(matchId: number, submissionId: string) {
  const [row] = await query<{
    submission_id: string;
    resulting_version: number;
    resulting_score_a: number;
    resulting_score_b: number;
    resulting_status: string | null;
    side_effects_completed: boolean;
  }>(
    `SELECT submission_id, resulting_version, resulting_score_a, resulting_score_b,
            resulting_status, side_effects_completed
       FROM match_leg_submissions
      WHERE match_id = $1 AND submission_id = $2`,
    [matchId, submissionId],
  );
  return row;
}

function leg(winner: "A" | "B", marker: number) {
  return {
    startingThrower: marker % 2 === 0 ? "A" as const : "B" as const,
    visits: [{ player: winner, score: 100 + marker }],
    winner,
    checkoutDartsUsed: 1,
  };
}

function notes(marker: number) {
  return {
    totalVisitsA: marker + 1,
    totalVisitsB: marker,
    totalScoredA: 100 + marker,
    totalScoredB: marker,
    highestVisitA: 100 + marker,
    highestVisitB: marker,
  };
}

async function assertAcceptedLegInvariant(
  matchId: number,
  before: DbMatch,
  submissionId: string,
): Promise<string> {
  const after = await getMatch(matchId);
  const history = await getHistory(matchId);
  const [countRow] = await query<{ count: string }>(
    `SELECT count(*)::text AS count
       FROM match_leg_submissions
      WHERE match_id = $1 AND submission_id = $2`,
    [matchId, submissionId],
  );
  const deltaA = after.score_a - before.score_a;
  const deltaB = after.score_b - before.score_b;
  assert.equal(after.score_a + after.score_b, history.length);
  assert.ok((deltaA === 1 && deltaB === 0) || (deltaA === 0 && deltaB === 1));
  assert.equal(after.scoring_version, before.scoring_version + 1);
  assert.equal(Number(countRow.count), 1);
  return `score=${after.score_a}-${after.score_b}; history=${history.length}; version=${after.scoring_version}; submissionRows=1`;
}

async function submit(input: {
  matchId: number;
  expectedVersion: number;
  submissionId: string;
  scoreA: number;
  scoreB: number;
  winner: "A" | "B";
  marker: number;
  noteOverride?: Record<string, unknown>;
}) {
  return storage.submitCompletedLeg({
    matchId: input.matchId,
    expectedVersion: input.expectedVersion,
    submissionId: input.submissionId,
    scoreA: input.scoreA,
    scoreB: input.scoreB,
    completedLeg: leg(input.winner, input.marker),
    notes: (input.noteOverride ?? notes(input.marker)) as any,
  });
}

async function scorerRequest(
  accessToken: string,
  matchId: number,
  body: Record<string, unknown>,
  method: "PUT" | "POST" = "PUT",
  suffix = "",
) {
  const response = await fetch(`${BASE_URL}/api/scorer/matches/${matchId}${suffix}`, {
    method,
    headers: {
      "content-type": "application/json",
      cookie: `boardAccessToken=${accessToken}`,
    },
    body: method === "PUT" ? JSON.stringify(body) : undefined,
  });
  const responseBody = await response.json().catch(() => null);
  return { status: response.status, body: responseBody };
}

async function runCase(
  report: Omit<CaseReport, "actual" | "databaseState" | "result">,
  action: () => Promise<{ actual: string; databaseState: string }>,
) {
  try {
    const outcome = await action();
    const completed: CaseReport = { ...report, ...outcome, result: "PASS" };
    reports.push(completed);
    console.log(`PASS: ${report.name}`);
  } catch (error) {
    const completed: CaseReport = {
      ...report,
      actual: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      databaseState: "Captured at the failing assertion; cleanup then ran in finally.",
      result: "FAIL",
    };
    reports.push(completed);
    console.error(`FAIL: ${report.name}: ${completed.actual}`);
    throw error;
  }
}

async function main() {
  try {
    const [branch] = await query<{ branch_id: string | null }>(
      `SELECT current_setting('neon.branch_id', true) AS branch_id`,
    );
    assert.equal(branch.branch_id, EXPECTED_BRANCH_ID, "destructive suite refused: unexpected Neon branch");

    const [user] = await query<{ id: number }>(
      `INSERT INTO users (email, password, name)
       VALUES ($1, 'disposable-test-password', $2)
       RETURNING id`,
      [`${runId}@example.invalid`, runId],
    );
    testUserId = user.id;

    await runCase({
      name: "Two concurrent leg submissions against the same match/version",
      setup: "Disposable in-progress best-of-5 match at 0-0/version 0.",
      sequence: [
        "Submit A-won leg with unique ID at expected version 0.",
        "Concurrently submit B-won leg with a different ID at expected version 0.",
      ],
      expected: "Exactly one commit; the other request receives STALE_SCORING_VERSION; accepted-leg invariants hold.",
    }, async () => {
      const tournamentId = await createTournament("concurrent");
      const a = await createPlayer(tournamentId, "a");
      const b = await createPlayer(tournamentId, "b");
      const matchId = await createMatch({ tournamentId, playerAId: a, playerBId: b });
      const before = await getMatch(matchId);
      const idA = randomUUID();
      const idB = randomUUID();
      const settled = await Promise.allSettled([
        submit({ matchId, expectedVersion: 0, submissionId: idA, scoreA: 1, scoreB: 0, winner: "A", marker: 1 }),
        submit({ matchId, expectedVersion: 0, submissionId: idB, scoreA: 0, scoreB: 1, winner: "B", marker: 2 }),
      ]);
      assert.equal(settled.filter(r => r.status === "fulfilled").length, 1);
      const rejection = settled.find(r => r.status === "rejected") as PromiseRejectedResult;
      assert.ok(rejection.reason instanceof ScoringConflictError);
      assert.equal(rejection.reason.code, "STALE_SCORING_VERSION");
      const acceptedId = settled[0].status === "fulfilled" ? idA : idB;
      const state = await assertAcceptedLegInvariant(matchId, before, acceptedId);
      const [allCount] = await query<{ count: string }>(
        `SELECT count(*)::text AS count FROM match_leg_submissions WHERE match_id = $1`,
        [matchId],
      );
      assert.equal(Number(allCount.count), 1);
      return { actual: "One fulfilled and one stale-version conflict.", databaseState: state };
    });

    await runCase({
      name: "Duplicate identical submission IDs",
      setup: "Disposable in-progress match at 0-0/version 0.",
      sequence: ["Submit one A-won leg.", "Submit the identical payload again with the same submission ID."],
      expected: "Second call is an idempotent replay; no second leg, version increment, note append, or submission row.",
    }, async () => {
      const tournamentId = await createTournament("duplicate");
      const a = await createPlayer(tournamentId, "a");
      const b = await createPlayer(tournamentId, "b");
      const matchId = await createMatch({ tournamentId, playerAId: a, playerBId: b });
      const before = await getMatch(matchId);
      const submissionId = randomUUID();
      const first = await submit({ matchId, expectedVersion: 0, submissionId, scoreA: 1, scoreB: 0, winner: "A", marker: 3 });
      const invariant = await assertAcceptedLegInvariant(matchId, before, submissionId);
      const replay = await submit({ matchId, expectedVersion: 0, submissionId, scoreA: 1, scoreB: 0, winner: "A", marker: 3 });
      assert.equal(first.replayed, false);
      assert.equal(replay.replayed, true);
      assert.deepEqual(
        [replay.match.scoreA, replay.match.scoreB, replay.match.scoringVersion],
        [1, 0, 1],
      );
      assert.equal((await getHistory(matchId)).length, 1);
      return { actual: "Second call returned replayed=true and original result.", databaseState: invariant };
    });

    await runCase({
      name: "Lost-response retry using the same submission ID",
      setup: "Disposable match at 0-0/version 0; first successful response is intentionally ignored.",
      sequence: ["Commit one B-won leg.", "Discard the returned value.", "Retry the same payload and ID."],
      expected: "Retry returns the accepted result without another write.",
    }, async () => {
      const tournamentId = await createTournament("lost-response");
      const a = await createPlayer(tournamentId, "a");
      const b = await createPlayer(tournamentId, "b");
      const matchId = await createMatch({ tournamentId, playerAId: a, playerBId: b });
      const before = await getMatch(matchId);
      const submissionId = randomUUID();
      await submit({ matchId, expectedVersion: 0, submissionId, scoreA: 0, scoreB: 1, winner: "B", marker: 4 });
      const replay = await submit({ matchId, expectedVersion: 0, submissionId, scoreA: 0, scoreB: 1, winner: "B", marker: 4 });
      assert.equal(replay.replayed, true);
      assert.deepEqual([replay.match.scoreA, replay.match.scoreB, replay.match.scoringVersion], [0, 1, 1]);
      const state = await assertAcceptedLegInvariant(matchId, before, submissionId);
      return { actual: "Retry returned the original 0-1/version 1 result.", databaseState: state };
    });

    await runCase({
      name: "Replay of an old accepted submission after later legs",
      setup: "Disposable best-of-5 match accepts two sequential legs.",
      sequence: ["Accept submission one at version 0.", "Accept submission two at version 1.", "Replay submission one."],
      expected: "Replay returns submission one's original 1-0/version 1 response while database remains at 1-1/version 2.",
    }, async () => {
      const tournamentId = await createTournament("old-replay");
      const a = await createPlayer(tournamentId, "a");
      const b = await createPlayer(tournamentId, "b");
      const matchId = await createMatch({ tournamentId, playerAId: a, playerBId: b });
      const id1 = randomUUID();
      const id2 = randomUUID();
      const before1 = await getMatch(matchId);
      await submit({ matchId, expectedVersion: 0, submissionId: id1, scoreA: 1, scoreB: 0, winner: "A", marker: 5 });
      await assertAcceptedLegInvariant(matchId, before1, id1);
      const before2 = await getMatch(matchId);
      await submit({ matchId, expectedVersion: 1, submissionId: id2, scoreA: 1, scoreB: 1, winner: "B", marker: 6 });
      const invariant = await assertAcceptedLegInvariant(matchId, before2, id2);
      const oldReplay = await submit({ matchId, expectedVersion: 0, submissionId: id1, scoreA: 1, scoreB: 0, winner: "A", marker: 5 });
      assert.equal(oldReplay.replayed, true);
      assert.deepEqual([oldReplay.match.scoreA, oldReplay.match.scoreB, oldReplay.match.scoringVersion], [1, 0, 1]);
      const current = await getMatch(matchId);
      assert.deepEqual([current.score_a, current.score_b, current.scoring_version], [1, 1, 2]);
      return { actual: "Old replay returned 1-0/version 1; current row stayed 1-1/version 2.", databaseState: invariant };
    });

    await runCase({
      name: "Winner mismatch between increment and completed-leg winner",
      setup: "Disposable match at 0-0/version 0.",
      sequence: ["Request score 1-0 while completedLeg.winner is B."],
      expected: "LEG_WINNER_MISMATCH and no database writes.",
    }, async () => {
      const tournamentId = await createTournament("winner-mismatch");
      const a = await createPlayer(tournamentId, "a");
      const b = await createPlayer(tournamentId, "b");
      const matchId = await createMatch({ tournamentId, playerAId: a, playerBId: b });
      const submissionId = randomUUID();
      await assert.rejects(
        submit({ matchId, expectedVersion: 0, submissionId, scoreA: 1, scoreB: 0, winner: "B", marker: 7 }),
        (error: unknown) => error instanceof ScoringConflictError && error.code === "LEG_WINNER_MISMATCH",
      );
      const current = await getMatch(matchId);
      assert.deepEqual([current.score_a, current.score_b, current.scoring_version], [0, 0, 0]);
      assert.equal((await getHistory(matchId)).length, 0);
      assert.equal(await getSubmission(matchId, submissionId), undefined);
      return { actual: "Rejected with LEG_WINNER_MISMATCH.", databaseState: "score=0-0; history=0; version=0; submissionRows=0" };
    });

    await runCase({
      name: "legHistory count mismatch versus authoritative score",
      setup: "Disposable match manually seeded to score 1-0/version 0 with empty legHistory.",
      sequence: ["Attempt to submit the next A-won leg from 1-0 to 2-0."],
      expected: "LEG_HISTORY_SCORE_MISMATCH and no writes.",
    }, async () => {
      const tournamentId = await createTournament("history-mismatch");
      const a = await createPlayer(tournamentId, "a");
      const b = await createPlayer(tournamentId, "b");
      const matchId = await createMatch({ tournamentId, playerAId: a, playerBId: b, scoreA: 1 });
      const submissionId = randomUUID();
      await assert.rejects(
        submit({ matchId, expectedVersion: 0, submissionId, scoreA: 2, scoreB: 0, winner: "A", marker: 8 }),
        (error: unknown) => error instanceof ScoringConflictError && error.code === "LEG_HISTORY_SCORE_MISMATCH",
      );
      const current = await getMatch(matchId);
      assert.deepEqual([current.score_a, current.score_b, current.scoring_version], [1, 0, 0]);
      assert.equal(await getSubmission(matchId, submissionId), undefined);
      return { actual: "Rejected with LEG_HISTORY_SCORE_MISMATCH.", databaseState: "score=1-0; history=0; version=0; submissionRows=0" };
    });

    await runCase({
      name: "Note persistence failure rollback",
      setup: "Disposable match at 0-0/version 0 with no match_notes row.",
      sequence: ["Submit a valid leg transition with a non-integer value for totalVisitsA."],
      expected: "PostgreSQL rejects note persistence and the entire transaction rolls back.",
    }, async () => {
      const tournamentId = await createTournament("note-rollback");
      const a = await createPlayer(tournamentId, "a");
      const b = await createPlayer(tournamentId, "b");
      const matchId = await createMatch({ tournamentId, playerAId: a, playerBId: b });
      const submissionId = randomUUID();
      await assert.rejects(
        submit({
          matchId,
          expectedVersion: 0,
          submissionId,
          scoreA: 1,
          scoreB: 0,
          winner: "A",
          marker: 9,
          noteOverride: { totalVisitsA: "not-an-integer" },
        }),
      );
      const current = await getMatch(matchId);
      const [noteCount] = await query<{ count: string }>(
        `SELECT count(*)::text AS count FROM match_notes WHERE match_id = $1`,
        [matchId],
      );
      assert.deepEqual([current.score_a, current.score_b, current.scoring_version], [0, 0, 0]);
      assert.equal(Number(noteCount.count), 0);
      assert.equal(await getSubmission(matchId, submissionId), undefined);
      return { actual: "Database type error raised; transaction rolled back.", databaseState: "score=0-0; notes=0; version=0; submissionRows=0" };
    });

    await runCase({
      name: "Match update failure rollback",
      setup: "Disposable match at 0-0 with scoring_version at PostgreSQL integer maximum.",
      sequence: ["Submit a valid leg; note upsert runs before match update.", "Match update attempts resulting version 2147483648."],
      expected: "Integer overflow rejects match update and rolls back the earlier note upsert.",
    }, async () => {
      const tournamentId = await createTournament("match-rollback");
      const a = await createPlayer(tournamentId, "a");
      const b = await createPlayer(tournamentId, "b");
      const matchId = await createMatch({
        tournamentId,
        playerAId: a,
        playerBId: b,
        scoringVersion: 2_147_483_647,
      });
      const submissionId = randomUUID();
      await assert.rejects(
        submit({
          matchId,
          expectedVersion: 2_147_483_647,
          submissionId,
          scoreA: 1,
          scoreB: 0,
          winner: "A",
          marker: 10,
        }),
      );
      const current = await getMatch(matchId);
      const [noteCount] = await query<{ count: string }>(
        `SELECT count(*)::text AS count FROM match_notes WHERE match_id = $1`,
        [matchId],
      );
      assert.deepEqual([current.score_a, current.score_b, current.scoring_version], [0, 0, 2_147_483_647]);
      assert.equal(Number(noteCount.count), 0);
      assert.equal(await getSubmission(matchId, submissionId), undefined);
      return { actual: "Integer overflow raised; transaction rolled back.", databaseState: "score=0-0; notes=0; version=2147483647; submissionRows=0" };
    });

    await runCase({
      name: "Scorer start invalidating stale saved state",
      setup: "Disposable pending knockout-only tournament with one board-authenticated match and a saved pending snapshot.",
      sequence: ["POST the real scorer start endpoint.", "Compare the old snapshot to the returned authoritative match."],
      expected: "Start changes status to IN_PROGRESS and increments scoring_version once; old snapshot is incompatible.",
    }, async () => {
      const tournamentId = await createTournament("start-invalidates");
      const a = await createPlayer(tournamentId, "a");
      const b = await createPlayer(tournamentId, "b");
      const matchId = await createMatch({
        tournamentId,
        playerAId: a,
        playerBId: b,
        status: "PENDING",
        roundKey: "R1",
        order: 0,
      });
      const token = await createBoardAccess(tournamentId, 1);
      const saved: SavedScorerIdentity = {
        matchId,
        playerAId: a,
        playerBId: b,
        bestOf: 5,
        serverScoreA: 0,
        serverScoreB: 0,
        legsWonA: 0,
        legsWonB: 0,
        scoringVersion: 0,
        status: "PENDING",
      };
      const response = await scorerRequest(token, matchId, {}, "POST", "/start");
      assert.equal(response.status, 200);
      assert.equal(response.body.status, "IN_PROGRESS");
      assert.equal(response.body.scoringVersion, 1);
      assert.equal(isSavedStateCompatible(saved, response.body), false);
      return { actual: "Start returned IN_PROGRESS/version 1; saved-state compatibility=false.", databaseState: "score=0-0; status=IN_PROGRESS; version=1" };
    });

    await runCase({
      name: "Admin reset invalidating a scorer session",
      setup: "Disposable in-progress match at 1-0/version 4 with matching saved scorer identity and one history row.",
      sequence: ["Apply the authoritative admin reset fields through storage.updateMatch.", "Compare old snapshot with reset match."],
      expected: "Reset produces PENDING/0-0/version 5 and invalidates the scorer snapshot.",
    }, async () => {
      const tournamentId = await createTournament("admin-reset");
      const a = await createPlayer(tournamentId, "a");
      const b = await createPlayer(tournamentId, "b");
      const matchId = await createMatch({
        tournamentId,
        playerAId: a,
        playerBId: b,
        scoreA: 1,
        scoringVersion: 4,
      });
      await query(
        `INSERT INTO match_notes (match_id, leg_history) VALUES ($1, $2::jsonb)`,
        [matchId, JSON.stringify([leg("A", 11)])],
      );
      const saved: SavedScorerIdentity = {
        matchId,
        playerAId: a,
        playerBId: b,
        bestOf: 5,
        serverScoreA: 1,
        serverScoreB: 0,
        legsWonA: 1,
        legsWonB: 0,
        scoringVersion: 4,
        status: "IN_PROGRESS",
      };
      const reset = await storage.updateMatch(matchId, {
        status: "PENDING",
        scoreA: 0,
        scoreB: 0,
        winnerId: null,
      });
      assert.equal(reset.scoringVersion, 5);
      assert.equal(isSavedStateCompatible(saved, reset), false);
      return { actual: "Reset returned PENDING/0-0/version 5; saved-state compatibility=false.", databaseState: "score=0-0; status=PENDING; version=5" };
    });

    await runCase({
      name: "Two scorer instances submitting against the same match",
      setup: "Disposable tournament with two independent board sessions and one 0-0/version 0 match.",
      sequence: ["Send two real scorer HTTP PUT requests concurrently from different board cookies at expected version 0."],
      expected: "One HTTP 200 and one HTTP 409; one accepted leg and one submission row.",
    }, async () => {
      const tournamentId = await createTournament("two-scorers");
      const a = await createPlayer(tournamentId, "a");
      const b = await createPlayer(tournamentId, "b");
      const matchId = await createMatch({ tournamentId, playerAId: a, playerBId: b });
      const token1 = await createBoardAccess(tournamentId, 1);
      const token2 = await createBoardAccess(tournamentId, 2);
      const before = await getMatch(matchId);
      const id1 = randomUUID();
      const id2 = randomUUID();
      const body1 = {
        scoreA: 1,
        scoreB: 0,
        expectedVersion: 0,
        legSubmissionId: id1,
        completedLeg: leg("A", 12),
        notes: notes(12),
      };
      const body2 = {
        scoreA: 0,
        scoreB: 1,
        expectedVersion: 0,
        legSubmissionId: id2,
        completedLeg: leg("B", 13),
        notes: notes(13),
      };
      const responses = await Promise.all([
        scorerRequest(token1, matchId, body1),
        scorerRequest(token2, matchId, body2),
      ]);
      assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
      const acceptedId = responses[0].status === 200 ? id1 : id2;
      const state = await assertAcceptedLegInvariant(matchId, before, acceptedId);
      const [countRow] = await query<{ count: string }>(
        `SELECT count(*)::text AS count FROM match_leg_submissions WHERE match_id = $1`,
        [matchId],
      );
      assert.equal(Number(countRow.count), 1);
      return { actual: `HTTP statuses ${responses[0].status} and ${responses[1].status}.`, databaseState: state };
    });

    await runCase({
      name: "Final-leg progression failure and safe retry/resume",
      setup: "Disposable R1 best-of-1 match feeding a final whose scoring_version is intentionally at integer maximum.",
      sequence: [
        "Submit the match-winning leg through the real scorer endpoint.",
        "Progression tries to populate the final and fails on revision overflow; response is HTTP 500.",
        "Repair only the disposable final's revision to 0.",
        "Retry the identical accepted submission ID.",
      ],
      expected: "Leg stays committed with side effects incomplete; retry returns original result, completes progression once, and marks side effects complete.",
    }, async () => {
      const tournamentId = await createTournament("progression-resume");
      const a = await createPlayer(tournamentId, "a");
      const b = await createPlayer(tournamentId, "b");
      const finalist = await createPlayer(tournamentId, "finalist");
      const currentId = await createMatch({
        tournamentId,
        playerAId: a,
        playerBId: b,
        bestOf: 1,
        roundKey: "R1",
        order: 0,
      });
      const finalId = await createMatch({
        tournamentId,
        playerAId: finalist,
        playerBId: b,
        bestOf: 1,
        status: "PENDING",
        scoringVersion: 2_147_483_647,
        roundKey: "F",
        order: 1,
      });
      const token = await createBoardAccess(tournamentId, 1);
      const submissionId = randomUUID();
      const before = await getMatch(currentId);
      const body = {
        scoreA: 1,
        scoreB: 0,
        expectedVersion: 0,
        legSubmissionId: submissionId,
        completedLeg: leg("A", 14),
        notes: notes(14),
      };
      const first = await scorerRequest(token, currentId, body);
      assert.equal(first.status, 500);
      const committed = await getMatch(currentId);
      assert.deepEqual([committed.score_a, committed.score_b, committed.scoring_version, committed.status], [1, 0, 1, "COMPLETED"]);
      await assertAcceptedLegInvariant(currentId, before, submissionId);
      const unfinished = await getSubmission(currentId, submissionId);
      assert.ok(unfinished);
      assert.equal(unfinished.side_effects_completed, false);
      const blockedFinal = await getMatch(finalId);
      assert.equal(blockedFinal.player_a_id, finalist);

      await query(`UPDATE matches SET scoring_version = 0 WHERE id = $1`, [finalId]);
      const retry = await scorerRequest(token, currentId, body);
      assert.equal(retry.status, 200);
      assert.equal(retry.body.idempotentReplay, true);
      assert.deepEqual([retry.body.scoreA, retry.body.scoreB, retry.body.scoringVersion], [1, 0, 1]);
      const progressedFinal = await getMatch(finalId);
      assert.equal(progressedFinal.player_a_id, a);
      assert.equal(progressedFinal.scoring_version, 1);
      const finished = await getSubmission(currentId, submissionId);
      assert.equal(finished.side_effects_completed, true);
      return {
        actual: "First response 500 after committed leg; identical retry returned 200 replay and resumed progression.",
        databaseState: `source=1-0/version 1/completed; final.playerA=${a}; final.version=1; sideEffectsCompleted=true`,
      };
    });

    await runCase({
      name: "Idempotent replay does not run bracket or tournament side effects twice",
      setup: "Use the successfully resumed progression match from a new disposable two-round bracket.",
      sequence: ["Accept and fully process a winning leg.", "Capture target match revision and tournament updated_at.", "Replay the identical submission."],
      expected: "Replay returns original result without changing target revision, tournament timestamp, history, or submission count.",
    }, async () => {
      const tournamentId = await createTournament("side-effect-once");
      const a = await createPlayer(tournamentId, "a");
      const b = await createPlayer(tournamentId, "b");
      const finalist = await createPlayer(tournamentId, "finalist");
      const currentId = await createMatch({
        tournamentId,
        playerAId: a,
        playerBId: b,
        bestOf: 1,
        roundKey: "R1",
        order: 0,
      });
      const finalId = await createMatch({
        tournamentId,
        playerAId: finalist,
        playerBId: b,
        bestOf: 1,
        status: "PENDING",
        roundKey: "F",
        order: 1,
      });
      const token = await createBoardAccess(tournamentId, 1);
      const submissionId = randomUUID();
      const before = await getMatch(currentId);
      const body = {
        scoreA: 1,
        scoreB: 0,
        expectedVersion: 0,
        legSubmissionId: submissionId,
        completedLeg: leg("A", 15),
        notes: notes(15),
      };
      const first = await scorerRequest(token, currentId, body);
      assert.equal(first.status, 200);
      await assertAcceptedLegInvariant(currentId, before, submissionId);
      const finalBeforeReplay = await getMatch(finalId);
      const [tournamentBefore] = await query<{ updated_at: Date | null }>(
        `SELECT updated_at FROM tournaments WHERE id = $1`,
        [tournamentId],
      );
      const replay = await scorerRequest(token, currentId, body);
      assert.equal(replay.status, 200);
      assert.equal(replay.body.idempotentReplay, true);
      const finalAfterReplay = await getMatch(finalId);
      const [tournamentAfter] = await query<{ updated_at: Date | null }>(
        `SELECT updated_at FROM tournaments WHERE id = $1`,
        [tournamentId],
      );
      assert.equal(finalAfterReplay.scoring_version, finalBeforeReplay.scoring_version);
      assert.equal(finalAfterReplay.player_a_id, finalBeforeReplay.player_a_id);
      assert.equal(tournamentAfter.updated_at?.getTime(), tournamentBefore.updated_at?.getTime());
      assert.equal((await getHistory(currentId)).length, 1);
      const [countRow] = await query<{ count: string }>(
        `SELECT count(*)::text AS count FROM match_leg_submissions WHERE match_id = $1`,
        [currentId],
      );
      assert.equal(Number(countRow.count), 1);
      return {
        actual: "Replay returned 200/idempotentReplay=true with no target or tournament mutation.",
        databaseState: `source history=1; submissions=1; final.version=${finalAfterReplay.scoring_version}; tournament.updatedAt unchanged`,
      };
    });

    await runCase({
      name: "Refresh/recovery during an unfinished current leg",
      setup: "Disposable in-progress 1-0/version 1 match with one persisted completed leg and a local unfinished-leg snapshot.",
      sequence: ["Persist only the completed leg in PostgreSQL.", "Construct local unfinished-leg state at remaining scores.", "Refetch authoritative match and run compatibility check."],
      expected: "Snapshot is compatible and recoverable; unfinished visits do not alter database score, history, version, or submissions.",
    }, async () => {
      const tournamentId = await createTournament("refresh-recovery");
      const a = await createPlayer(tournamentId, "a");
      const b = await createPlayer(tournamentId, "b");
      const matchId = await createMatch({ tournamentId, playerAId: a, playerBId: b });
      const submissionId = randomUUID();
      const before = await getMatch(matchId);
      await submit({ matchId, expectedVersion: 0, submissionId, scoreA: 1, scoreB: 0, winner: "A", marker: 16 });
      const invariant = await assertAcceptedLegInvariant(matchId, before, submissionId);
      const authoritative = await storage.getMatch(matchId);
      assert.ok(authoritative);
      const saved: SavedScorerIdentity = {
        matchId,
        playerAId: a,
        playerBId: b,
        bestOf: 5,
        serverScoreA: 1,
        serverScoreB: 0,
        legsWonA: 1,
        legsWonB: 0,
        scoringVersion: 1,
        status: "IN_PROGRESS",
      };
      assert.equal(isSavedStateCompatible(saved, authoritative), true);
      const after = await getMatch(matchId);
      assert.deepEqual([after.score_a, after.score_b, after.scoring_version], [1, 0, 1]);
      assert.equal((await getHistory(matchId)).length, 1);
      return { actual: "Saved unfinished-leg identity remained compatible after authoritative refetch.", databaseState: invariant };
    });
  } finally {
    if (testUserId !== null) {
      await query(`DELETE FROM users WHERE id = $1`, [testUserId]);
      const [remaining] = await query<{ count: string }>(
        `SELECT count(*)::text AS count FROM tournaments WHERE name LIKE $1`,
        [`${runId}%`],
      );
      assert.equal(Number(remaining.count), 0, "disposable tournament cleanup failed");
    }
    console.log(`STAGE1_DB_REPORT=${JSON.stringify(reports)}`);
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});