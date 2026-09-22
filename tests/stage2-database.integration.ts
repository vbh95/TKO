import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../server/db";

const EXPECTED_BRANCH_ID = "br-weathered-feather-abr2c9zx";

const configuredDomain = process.env.REPLIT_DEV_DOMAIN;
const BASE_URL = configuredDomain
  ? configuredDomain.startsWith("http")
    ? configuredDomain
    : `https://${configuredDomain}`
  : "http://127.0.0.1:5000";
const runId = `stage2-db-${Date.now()}-${randomUUID().slice(0, 8)}`;
let disposableUserId: number | null = null;
let playerCounter = 0;
let matchCounter = 0;

type DbMatch = {
  id: number;
  tournament_id: number;
  score_a: number;
  score_b: number;
  status: string;
  scoring_version: number;
};

type BoardAccess = {
  id: number;
  token: string;
  boardNumber: number;
};

async function query<T = any>(text: string, values: unknown[] = []): Promise<T[]> {
  return (await pool.query(text, values)).rows as T[];
}

async function createTournament(label: string): Promise<number> {
  assert.ok(disposableUserId);
  const [row] = await query<{ id: number }>(
    `INSERT INTO tournaments (user_id, name, type, status, settings, is_legacy)
     VALUES ($1, $2, 'KNOCKOUT', 'IN_PROGRESS', $3::jsonb, false)
     RETURNING id`,
    [disposableUserId, `${runId}-${label}`, JSON.stringify({ numBoards: 2 })],
  );
  await query(
    `INSERT INTO groups (tournament_id, name) VALUES ($1, 'Group A'), ($1, 'Group B')`,
    [row.id],
  );
  return row.id;
}

async function createPlayer(tournamentId: number, label: string): Promise<number> {
  playerCounter += 1;
  const [row] = await query<{ id: number }>(
    `INSERT INTO players (tournament_id, name)
     VALUES ($1, $2) RETURNING id`,
    [tournamentId, `${runId}-${label}-${playerCounter}`],
  );
  return row.id;
}

async function createMatch(options: {
  tournamentId: number;
  boardNumber?: number;
  status?: "PENDING" | "IN_PROGRESS";
  scoreA?: number;
  scoreB?: number;
  scoringVersion?: number;
}): Promise<number> {
  matchCounter += 1;
  const playerAId = await createPlayer(options.tournamentId, `a-${matchCounter}`);
  const playerBId = await createPlayer(options.tournamentId, `b-${matchCounter}`);
  const [row] = await query<{ id: number }>(
    `INSERT INTO matches (
       tournament_id, stage, round_key, player_a_id, player_b_id, score_a, score_b,
       best_of, status, "order", board_number, scoring_version
     ) VALUES ($1, 'KNOCKOUT', $2, $3, $4, $5, $6, 5, $7, $8, $9, $10)
     RETURNING id`,
    [
      options.tournamentId,
      `STAGE2_${matchCounter}`,
      playerAId,
      playerBId,
      options.scoreA ?? 0,
      options.scoreB ?? 0,
      options.status ?? "IN_PROGRESS",
      matchCounter,
      options.boardNumber ?? 1,
      options.scoringVersion ?? 0,
    ],
  );
  return row.id;
}

async function createBoardAccess(
  tournamentId: number,
  boardNumber: number,
): Promise<BoardAccess> {
  const token = `${runId}-access-${randomUUID()}`;
  const [row] = await query<{ id: number }>(
    `INSERT INTO board_sessions (
       tournament_id, board_number, pairing_token, access_token, paired_at, expires_at
     ) VALUES ($1, $2, $3, $4, now(), now() + interval '1 hour')
     RETURNING id`,
    [tournamentId, boardNumber, `${runId}-pair-${randomUUID()}`, token],
  );
  return { id: row.id, token, boardNumber };
}

async function getMatch(matchId: number): Promise<DbMatch> {
  const [row] = await query<DbMatch>(
    `SELECT id, tournament_id, score_a, score_b, status, scoring_version
       FROM matches WHERE id = $1`,
    [matchId],
  );
  assert.ok(row);
  return row;
}

async function getHistory(matchId: number): Promise<unknown[]> {
  const [row] = await query<{ leg_history: unknown[] | null }>(
    `SELECT leg_history FROM match_notes WHERE match_id = $1`,
    [matchId],
  );
  return Array.isArray(row?.leg_history) ? row.leg_history : [];
}

function leg(winner: "A" | "B", marker: number) {
  const loser = winner === "A" ? "B" : "A";
  return {
    startingThrower: winner,
    visits: [
      { player: winner, score: 180 },
      { player: loser, score: 0 },
      { player: winner, score: 180 },
      { player: loser, score: 0 },
      { player: winner, score: 141 },
    ],
    winner,
    checkoutDartsUsed: 3,
  };
}

function emptyCheckoutStats() {
  return {
    attemptsA: 0,
    attemptsB: 0,
    successA: 0,
    successB: 0,
    finishA: 0,
    finishB: 0,
    first9PointsA: 0,
    first9DartsA: 0,
    first9PointsB: 0,
    first9DartsB: 0,
    totalCheckoutDartsUsedA: 0,
    totalCheckoutDartsUsedB: 0,
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

async function scorerRequest(
  access: BoardAccess,
  matchId: number,
  suffix: string,
  method: "GET" | "POST" | "PUT" = "POST",
  body?: Record<string, unknown>,
) {
  const response = await fetch(`${BASE_URL}/api/scorer/matches/${matchId}${suffix}`, {
    method,
    headers: {
      "content-type": "application/json",
      cookie: `boardAccessToken=${access.token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: response.status,
    body: await response.json().catch(() => null),
  };
}

async function boardData(access: BoardAccess) {
  const response = await fetch(`${BASE_URL}/api/scorer/board-data?token=${encodeURIComponent(access.token)}`, {
    headers: { cookie: `boardAccessToken=${access.token}` },
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

async function postCurrentLeg(
  access: BoardAccess,
  matchId: number,
  state: {
    scoringVersion: number;
    remainingA: number;
    remainingB: number;
    currentThrower: "A" | "B";
    legStartingThrower: "A" | "B";
    visits: Array<{ player: "A" | "B"; score: number }>;
    checkoutStats: ReturnType<typeof emptyCheckoutStats>;
    pendingCheckout: { player: "A" | "B"; newLegsA: number; newLegsB: number; checkoutScore: number } | null;
    swapPlayers?: boolean;
  },
) {
  const current = await getMatch(matchId);
  const visitsA = state.visits.filter(visit => visit.player === "A");
  const visitsB = state.visits.filter(visit => visit.player === "B");
  return scorerRequest(access, matchId, "/leg-scoring", "POST", {
    ...state,
    swapPlayers: state.swapPlayers ?? false,
    legsWonA: current.score_a,
    legsWonB: current.score_b,
    playerAName: "A",
    playerBName: "B",
    bestOf: 5,
    avgA: visitsA.length ? (visitsA.reduce((sum, visit) => sum + visit.score, 0) / visitsA.length).toFixed(2) : "0.00",
    avgB: visitsB.length ? (visitsB.reduce((sum, visit) => sum + visit.score, 0) / visitsB.length).toFixed(2) : "0.00",
    dartsA: visitsA.length * 3,
    dartsB: visitsB.length * 3,
    lastScoreA: visitsA.at(-1)?.score ?? null,
    lastScoreB: visitsB.at(-1)?.score ?? null,
  });
}

async function start(access: BoardAccess, matchId: number) {
  return scorerRequest(access, matchId, "/start");
}

async function acquire(access: BoardAccess, matchId: number, takeover = false) {
  return scorerRequest(
    access,
    matchId,
    takeover ? "/ownership/takeover" : "/ownership/acquire",
    "POST",
    takeover ? { confirm: true } : undefined,
  );
}

async function submit(
  access: BoardAccess,
  matchId: number,
  expectedVersion: number,
  submissionId = randomUUID(),
  winner: "A" | "B" = "A",
  scoreOverride?: { scoreA: number; scoreB: number },
  persistCurrentLeg = true,
) {
  const current = await getMatch(matchId);
  const nextA = scoreOverride?.scoreA ?? current.score_a + (winner === "A" ? 1 : 0);
  const nextB = scoreOverride?.scoreB ?? current.score_b + (winner === "B" ? 1 : 0);
  const completedLeg = leg(winner, matchCounter);
  if (persistCurrentLeg) {
    const winnerIsA = winner === "A";
    const visitsA = completedLeg.visits.filter(visit => visit.player === "A");
    const visitsB = completedLeg.visits.filter(visit => visit.player === "B");
    const persisted = await scorerRequest(access, matchId, "/leg-scoring", "POST", {
      scoringVersion: expectedVersion,
      remainingA: winnerIsA ? 0 : 501,
      remainingB: winnerIsA ? 501 : 0,
      currentThrower: winner,
      legStartingThrower: winner,
      visits: completedLeg.visits,
      checkoutStats: emptyCheckoutStats(),
      pendingCheckout: {
        player: winner,
        newLegsA: nextA,
        newLegsB: nextB,
        checkoutScore: 141,
      },
      swapPlayers: false,
      legsWonA: current.score_a,
      legsWonB: current.score_b,
      playerAName: "A",
      playerBName: "B",
      bestOf: 5,
      avgA: visitsA.length ? (visitsA.reduce((sum, visit) => sum + visit.score, 0) / visitsA.length).toFixed(2) : "0.00",
      avgB: visitsB.length ? (visitsB.reduce((sum, visit) => sum + visit.score, 0) / visitsB.length).toFixed(2) : "0.00",
      dartsA: visitsA.length * 3,
      dartsB: visitsB.length * 3,
      lastScoreA: visitsA.at(-1)?.score ?? null,
      lastScoreB: visitsB.at(-1)?.score ?? null,
    });
    if (persisted.status !== 200) return persisted;
  }
  return scorerRequest(access, matchId, "", "PUT", {
    scoreA: nextA,
    scoreB: nextB,
    expectedVersion,
    legSubmissionId: submissionId,
    completedLeg,
    notes: notes(matchCounter),
    checkout: { dartsAtDouble: 1, checkoutDartsUsed: 3 },
  });
}

async function pass(name: string, action: () => Promise<void>) {
  await action();
  console.log(`PASS: ${name}`);
}

async function main() {
  try {
    const [branch] = await query<{ branch_id: string | null }>(
      `SELECT current_setting('neon.branch_id', true) AS branch_id`,
    );
    assert.equal(
      branch.branch_id,
      EXPECTED_BRANCH_ID,
      "Stage 2 integration suite refused: unexpected Neon branch",
    );

    const [user] = await query<{ id: number }>(
      `INSERT INTO users (email, password, name)
       VALUES ($1, 'stage2-disposable-password', $2) RETURNING id`,
      [`${runId}@example.invalid`, runId],
    );
    disposableUserId = user.id;

    await pass("A one scorer normal flow", async () => {
      const tournamentId = await createTournament("a");
      const matchId = await createMatch({ tournamentId, status: "PENDING" });
      const a = await createBoardAccess(tournamentId, 1);
      const started = await start(a, matchId);
      assert.equal(started.status, 200);
      const first = await submit(a, matchId, started.body.scoringVersion);
      assert.equal(first.status, 200);
      const second = await submit(a, matchId, first.body.scoringVersion, randomUUID(), "B");
      assert.equal(second.status, 200);
      assert.deepEqual([second.body.scoreA, second.body.scoreB], [1, 1]);
    });

    await pass("B second scorer blocked without mutation", async () => {
      const tournamentId = await createTournament("b");
      const matchId = await createMatch({ tournamentId, status: "PENDING" });
      const a = await createBoardAccess(tournamentId, 1);
      const b = await createBoardAccess(tournamentId, 1);
      assert.equal((await start(a, matchId)).status, 200);
      const before = await getMatch(matchId);
      const response = await submit(b, matchId, before.scoring_version);
      assert.equal(response.status, 409);
      assert.deepEqual(await getMatch(matchId), before);
    });

    await pass("C explicit takeover transfers authority", async () => {
      const tournamentId = await createTournament("c");
      const matchId = await createMatch({ tournamentId });
      const a = await createBoardAccess(tournamentId, 1);
      const b = await createBoardAccess(tournamentId, 1);
      assert.equal((await acquire(a, matchId)).status, 200);
      assert.equal((await acquire(b, matchId, true)).status, 200);
      assert.equal((await submit(b, matchId, 0)).status, 200);
      assert.equal((await submit(a, matchId, 0)).status, 409);
    });

    await pass("D stale device with valid version is rejected by ownership", async () => {
      const tournamentId = await createTournament("d");
      const matchId = await createMatch({ tournamentId });
      const a = await createBoardAccess(tournamentId, 1);
      const b = await createBoardAccess(tournamentId, 1);
      assert.equal((await acquire(a, matchId)).status, 200);
      assert.equal((await acquire(b, matchId, true)).status, 200);
      const before = await getMatch(matchId);
      assert.equal((await submit(a, matchId, before.scoring_version)).status, 409);
      assert.deepEqual(await getMatch(matchId), before);
    });

    await pass("E same-session refresh reacquires without losing state", async () => {
      const tournamentId = await createTournament("e");
      const matchId = await createMatch({ tournamentId });
      const a = await createBoardAccess(tournamentId, 1);
      assert.equal((await acquire(a, matchId)).status, 200);
      const firstLeg = await submit(a, matchId, 0);
      assert.equal(firstLeg.status, 200);
      const before = await getMatch(matchId);
      assert.equal((await acquire(a, matchId)).status, 200);
      assert.deepEqual(await getMatch(matchId), before);
      assert.deepEqual([before.score_a, before.score_b], [1, 0]);
    });

    await pass("F expired lease can be recovered", async () => {
      const tournamentId = await createTournament("f");
      const matchId = await createMatch({ tournamentId });
      const a = await createBoardAccess(tournamentId, 1);
      const b = await createBoardAccess(tournamentId, 1);
      assert.equal((await acquire(a, matchId)).status, 200);
      await query(`UPDATE scorer_leases SET expires_at = now() - interval '1 second' WHERE match_id = $1`, [matchId]);
      assert.equal((await acquire(b, matchId)).status, 200);
    });

    await pass("G wrong-board start is rejected", async () => {
      const tournamentId = await createTournament("g");
      const matchId = await createMatch({ tournamentId, status: "PENDING", boardNumber: 2 });
      const boardOne = await createBoardAccess(tournamentId, 1);
      assert.equal((await start(boardOne, matchId)).status, 403);
    });

    await pass("H wrong-board completed leg is rejected without mutation", async () => {
      const tournamentId = await createTournament("h");
      const matchId = await createMatch({ tournamentId, boardNumber: 2 });
      const boardOne = await createBoardAccess(tournamentId, 1);
      const before = await getMatch(matchId);
      assert.equal((await submit(boardOne, matchId, before.scoring_version)).status, 403);
      assert.deepEqual(await getMatch(matchId), before);
      assert.equal((await getHistory(matchId)).length, 0);
    });

    await pass("I wrong-board live scoring is rejected", async () => {
      const tournamentId = await createTournament("i");
      const matchId = await createMatch({ tournamentId, boardNumber: 2 });
      const boardOne = await createBoardAccess(tournamentId, 1);
      const response = await scorerRequest(boardOne, matchId, "/leg-scoring", "POST", { remainingA: 100 });
      assert.equal(response.status, 403);
    });

    await pass("J simultaneous starts serialize per board", async () => {
      const tournamentId = await createTournament("j");
      const firstMatch = await createMatch({ tournamentId, status: "PENDING", boardNumber: 1 });
      const secondMatch = await createMatch({ tournamentId, status: "PENDING", boardNumber: 1 });
      const a = await createBoardAccess(tournamentId, 1);
      const b = await createBoardAccess(tournamentId, 1);
      const responses = await Promise.all([start(a, firstMatch), start(b, secondMatch)]);
      assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
      const states = await Promise.all([getMatch(firstMatch), getMatch(secondMatch)]);
      assert.equal(states.filter(m => m.status === "IN_PROGRESS").length, 1);
    });

    await pass("K concurrent free lease acquisition has one owner", async () => {
      const tournamentId = await createTournament("k");
      const matchId = await createMatch({ tournamentId });
      const a = await createBoardAccess(tournamentId, 1);
      const b = await createBoardAccess(tournamentId, 1);
      const responses = await Promise.all([acquire(a, matchId), acquire(b, matchId)]);
      assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
      const [lease] = await query<{ board_session_id: number }>(
        `SELECT board_session_id FROM scorer_leases WHERE match_id = $1`,
        [matchId],
      );
      assert.ok(lease);
      assert.ok([a.id, b.id].includes(lease.board_session_id));
    });

    await pass("L takeover blocks pending work without an extra leg", async () => {
      const tournamentId = await createTournament("l");
      const matchId = await createMatch({ tournamentId });
      const a = await createBoardAccess(tournamentId, 1);
      const b = await createBoardAccess(tournamentId, 1);
      assert.equal((await acquire(a, matchId)).status, 200);
      assert.equal((await acquire(b, matchId, true)).status, 200);
      const beforeHistory = await getHistory(matchId);
      assert.equal((await submit(a, matchId, 0)).status, 409);
      assert.equal((await getHistory(matchId)).length, beforeHistory.length);
    });

    await pass("Stage 1 replay and stale version remain protected for owner", async () => {
      const tournamentId = await createTournament("stage1");
      const matchId = await createMatch({ tournamentId });
      const a = await createBoardAccess(tournamentId, 1);
      assert.equal((await acquire(a, matchId)).status, 200);
      const submissionId = randomUUID();
      const first = await submit(a, matchId, 0, submissionId);
      assert.equal(first.status, 200);
      const replay = await submit(a, matchId, 0, submissionId, "A", { scoreA: 1, scoreB: 0 }, false);
      assert.equal(replay.status, 200);
      assert.equal(replay.body.idempotentReplay, true);
      const stale = await submit(a, matchId, 0);
      assert.equal(stale.status, 409);
      assert.equal((await getHistory(matchId)).length, 1);
    });

    await pass("Stage 2B durable takeover, recovery, completion, and reset", async () => {
      const tournamentId = await createTournament("stage2b");
      const matchId = await createMatch({ tournamentId });
      const a = await createBoardAccess(tournamentId, 1);
      const b = await createBoardAccess(tournamentId, 1);
      assert.equal((await acquire(a, matchId)).status, 200);

      const visits = [
        { player: "A" as const, score: 180 },
        { player: "B" as const, score: 180 },
        { player: "A" as const, score: 180 },
        { player: "B" as const, score: 180 },
      ];
      const stats = {
        ...emptyCheckoutStats(),
        attemptsB: 2,
        first9PointsA: 120,
        first9DartsA: 3,
      };
      assert.equal((await postCurrentLeg(a, matchId, {
        scoringVersion: 0,
        remainingA: 141,
        remainingB: 141,
        currentThrower: "A",
        legStartingThrower: "A",
        visits,
        checkoutStats: stats,
        pendingCheckout: null,
        swapPlayers: true,
      })).status, 200);

      const refresh = await boardData(a);
      const refreshedMatch = refresh.body.matches.find((match: any) => match.id === matchId);
      assert.equal(refreshedMatch.currentLegState.remainingA, 141);
      assert.deepEqual(refreshedMatch.currentLegState.visits, visits);
      assert.equal(refreshedMatch.currentLegState.checkoutStats.attemptsB, 2);

      const invalid = await postCurrentLeg(a, matchId, {
        scoringVersion: 0,
        remainingA: 140,
        remainingB: 141,
        currentThrower: "B",
        legStartingThrower: "A",
        visits: [...visits, { player: "A", score: 2 }],
        checkoutStats: stats,
        pendingCheckout: null,
      });
      assert.equal(invalid.status, 400);
      const [unchanged] = await query<{ remaining_a: number; visits: unknown[] }>(
        `SELECT remaining_a, visits FROM scorer_current_legs WHERE match_id = $1`,
        [matchId],
      );
      assert.equal(unchanged.remaining_a, 141);
      assert.deepEqual(unchanged.visits, visits);

      assert.equal((await acquire(b, matchId, true)).status, 200);
      const takeover = await boardData(b);
      const takeoverMatch = takeover.body.matches.find((match: any) => match.id === matchId);
      assert.equal(takeoverMatch.currentLegState.remainingB, 141);
      assert.deepEqual(takeoverMatch.currentLegState.visits, visits);

      assert.equal((await postCurrentLeg(a, matchId, {
        scoringVersion: 0,
        remainingA: 0,
        remainingB: 141,
        currentThrower: "A",
        legStartingThrower: "A",
        visits: [...visits, { player: "A", score: 141 }],
        checkoutStats: stats,
        pendingCheckout: { player: "A", newLegsA: 1, newLegsB: 0, checkoutScore: 141 },
      })).status, 409);

      const completedVisits = [...visits, { player: "A" as const, score: 141 }];
      assert.equal((await postCurrentLeg(b, matchId, {
        scoringVersion: 0,
        remainingA: 0,
        remainingB: 141,
        currentThrower: "A",
        legStartingThrower: "A",
        visits: completedVisits,
        checkoutStats: stats,
        pendingCheckout: { player: "A", newLegsA: 1, newLegsB: 0, checkoutScore: 141 },
        swapPlayers: true,
      })).status, 200);

      const failedCompletion = await scorerRequest(b, matchId, "", "PUT", {
        scoreA: 1,
        scoreB: 0,
        expectedVersion: 0,
        legSubmissionId: randomUUID(),
        completedLeg: { startingThrower: "A", visits: completedVisits, winner: "A", checkoutDartsUsed: 2 },
        notes: {},
        checkout: { dartsAtDouble: 1, checkoutDartsUsed: 3 },
      });
      assert.equal(failedCompletion.status, 409);
      const [stillReady] = await query<{ remaining_a: number; pending_checkout: { player: string } }>(
        `SELECT remaining_a, pending_checkout FROM scorer_current_legs WHERE match_id = $1`,
        [matchId],
      );
      assert.equal(stillReady.remaining_a, 0);
      assert.equal(stillReady.pending_checkout.player, "A");

      const completed = await scorerRequest(b, matchId, "", "PUT", {
        scoreA: 1,
        scoreB: 0,
        expectedVersion: 0,
        legSubmissionId: randomUUID(),
        completedLeg: { startingThrower: "A", visits: completedVisits, winner: "A", checkoutDartsUsed: 3 },
        notes: { totalScoredA: 999999 },
        checkout: { dartsAtDouble: 1, checkoutDartsUsed: 3 },
      });
      assert.equal(completed.status, 200);
      const [note] = await query<any>(
        `SELECT total_scored_a, total_scored_b, total_visits_a, total_visits_b,
                first9_points_a, first9_darts_a, first9_points_b, first9_darts_b,
                checkout_attempts_a, checkout_attempts_b, checkout_success_a, highest_finish_a
           FROM match_notes WHERE match_id = $1`,
        [matchId],
      );
      assert.deepEqual(
        {
          totalScoredA: note.total_scored_a,
          totalScoredB: note.total_scored_b,
          totalVisitsA: note.total_visits_a,
          totalVisitsB: note.total_visits_b,
          first9PointsA: note.first9_points_a,
          first9DartsA: note.first9_darts_a,
          first9PointsB: note.first9_points_b,
          first9DartsB: note.first9_darts_b,
          attemptsA: note.checkout_attempts_a,
          attemptsB: note.checkout_attempts_b,
          successA: note.checkout_success_a,
          finishA: note.highest_finish_a,
        },
        {
          totalScoredA: 501,
          totalScoredB: 360,
          totalVisitsA: 3,
          totalVisitsB: 2,
          first9PointsA: 621,
          first9DartsA: 12,
          first9PointsB: 360,
          first9DartsB: 6,
          attemptsA: 1,
          attemptsB: 2,
          successA: 1,
          finishA: 141,
        },
      );
      const [nextLeg] = await query<any>(
        `SELECT scoring_version, remaining_a, remaining_b, visits, checkout_stats, swap_players
           FROM scorer_current_legs WHERE match_id = $1`,
        [matchId],
      );
      assert.equal(nextLeg.scoring_version, 1);
      assert.equal(nextLeg.remaining_a, 501);
      assert.equal(nextLeg.remaining_b, 501);
      assert.deepEqual(nextLeg.visits, []);
      assert.equal(nextLeg.checkout_stats.attemptsB, 2);
      assert.equal(nextLeg.swap_players, true);

      assert.equal((await scorerRequest(b, matchId, "/restart")).status, 200);
      const [afterRestart] = await query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM scorer_current_legs WHERE match_id = $1`,
        [matchId],
      );
      assert.equal(afterRestart.count, 0);
    });
  } finally {
    if (disposableUserId !== null) {
      await query(`DELETE FROM users WHERE id = $1`, [disposableUserId]);
    }
    await pool.end();
  }
}

main().catch(error => {
  console.error(`FAIL: Stage 2 database integration: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});