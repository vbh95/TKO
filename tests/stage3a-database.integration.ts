import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { io, type Socket } from "socket.io-client";
import { pool } from "../server/db";
import { storage } from "../server/storage";

// All writes below are disposable and MUST be refused on any other branch.
const EXPECTED_BRANCH_ID = "br-weathered-feather-abr2c9zx";
const domain = process.env.REPLIT_DEV_DOMAIN;
const BASE_URL = domain ? (domain.startsWith("http") ? domain : `https://${domain}`) : "http://127.0.0.1:5000";
const runId = `stage3a-${Date.now()}-${randomUUID().slice(0, 8)}`;
let userId: number | null = null;
let matchCounter = 0;
let passed = 0;
let failed = 0;

type Visit = { player: "A" | "B"; score: number };
type Pending = { player: "A" | "B"; newLegsA: number; newLegsB: number; checkoutScore: number };
type Leg = {
  scoringVersion: number;
  remainingA: number;
  remainingB: number;
  currentThrower: "A" | "B";
  legStartingThrower: "A" | "B";
  visits: Visit[];
  pendingCheckout: Pending | null;
};
type Access = { token: string };

async function query<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await pool.query(sql, params)).rows as T[];
}

async function tournament(label: string): Promise<number> {
  assert.ok(userId);
  const [row] = await query<{ id: number }>(
    `INSERT INTO tournaments (user_id, name, type, status, settings, is_legacy)
     VALUES ($1, $2, 'KNOCKOUT', 'IN_PROGRESS', '{}'::jsonb, false) RETURNING id`,
    [userId, `${runId}-${label}`],
  );
  return row.id;
}

async function player(tid: number, label: string): Promise<number> {
  const [row] = await query<{ id: number }>(
    `INSERT INTO players (tournament_id, name) VALUES ($1, $2) RETURNING id`,
    [tid, `${runId}-${label}-${randomUUID().slice(0, 6)}`],
  );
  return row.id;
}

async function match(tid: number, options: {
  a?: number; b?: number; bestOf?: number; roundKey?: string;
  status?: "PENDING" | "IN_PROGRESS"; scoringVersion?: number; order?: number;
} = {}) {
  matchCounter++;
  const a = options.a ?? await player(tid, "A");
  const b = options.b ?? await player(tid, "B");
  const [row] = await query<{ id: number }>(
    `INSERT INTO matches (
       tournament_id, stage, round_key, player_a_id, player_b_id, score_a, score_b,
       best_of, status, "order", board_number, scoring_version
     ) VALUES ($1, 'KNOCKOUT', $2, $3, $4, 0, 0, $5, $6, $7, 1, $8) RETURNING id`,
    [tid, options.roundKey ?? `TEST_${matchCounter}`, a, b, options.bestOf ?? 5,
      options.status ?? "IN_PROGRESS", options.order ?? matchCounter, options.scoringVersion ?? 0],
  );
  return { id: row.id, a, b };
}

async function access(tid: number): Promise<Access> {
  const token = `${runId}-${randomUUID()}`;
  await query(
    `INSERT INTO board_sessions (tournament_id, board_number, pairing_token, access_token, paired_at, expires_at)
     VALUES ($1, 1, $2, $3, now(), now() + interval '1 hour')`,
    [tid, `${runId}-${randomUUID()}`, token],
  );
  return { token };
}

async function request(a: Access, path: string, method: "GET" | "POST" | "PUT" = "GET", body?: unknown) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "content-type": "application/json", cookie: `boardAccessToken=${a.token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

const boardData = (a: Access) => request(a, "/api/scorer/board-data");
const acquire = (a: Access, id: number, takeover = false) =>
  request(a, `/api/scorer/matches/${id}/ownership/${takeover ? "takeover" : "acquire"}`, "POST",
    takeover ? { confirm: true } : undefined);

async function boardMatch(a: Access, id: number): Promise<any> {
  const response = await boardData(a);
  assert.equal(response.status, 200, `board-data failed: ${JSON.stringify(response.body)}`);
  const result = response.body.matches.find((m: any) => m.id === id);
  assert.ok(result, `match ${id} must appear in board-data`);
  return result;
}

function emptyStats() {
  return {
    attemptsA: 0, attemptsB: 0, successA: 0, successB: 0, finishA: 0, finishB: 0,
    first9PointsA: 0, first9DartsA: 0, first9PointsB: 0, first9DartsB: 0,
    totalCheckoutDartsUsedA: 0, totalCheckoutDartsUsedB: 0,
  };
}

function untouched(): Leg {
  return {
    scoringVersion: 0, remainingA: 501, remainingB: 501,
    currentThrower: "A", legStartingThrower: "A", visits: [], pendingCheckout: null,
  };
}

async function saveLeg(a: Access, id: number, state: Leg, stats = emptyStats()) {
  const [m] = await query<{ score_a: number; score_b: number; best_of: number }>(
    `SELECT score_a, score_b, best_of FROM matches WHERE id = $1`, [id],
  );
  const visitsA = state.visits.filter(v => v.player === "A");
  const visitsB = state.visits.filter(v => v.player === "B");
  return request(a, `/api/scorer/matches/${id}/leg-scoring`, "POST", {
    ...state, checkoutStats: stats, swapPlayers: false,
    legsWonA: m.score_a, legsWonB: m.score_b, bestOf: m.best_of,
    playerAName: "A", playerBName: "B",
    avgA: visitsA.length ? (visitsA.reduce((n, v) => n + v.score, 0) / visitsA.length).toFixed(2) : "0.00",
    avgB: visitsB.length ? (visitsB.reduce((n, v) => n + v.score, 0) / visitsB.length).toFixed(2) : "0.00",
    dartsA: visitsA.length * 3, dartsB: visitsB.length * 3,
    lastScoreA: visitsA.at(-1)?.score ?? null, lastScoreB: visitsB.at(-1)?.score ?? null,
  });
}

const completedVisits: Visit[] = [
  { player: "A", score: 180 }, { player: "B", score: 0 },
  { player: "A", score: 180 }, { player: "B", score: 0 },
  { player: "A", score: 141 },
];
const pending: Pending = { player: "A", newLegsA: 1, newLegsB: 0, checkoutScore: 141 };

async function readyLeg(a: Access, id: number) {
  const saved = await saveLeg(a, id, {
    ...untouched(), remainingA: 0, currentThrower: "A",
    visits: completedVisits, pendingCheckout: pending,
  });
  assert.equal(saved.status, 200, `checkout-ready save failed: ${JSON.stringify(saved.body)}`);
}

const submit = (a: Access, id: number, submissionId: string) =>
  request(a, `/api/scorer/matches/${id}`, "PUT", {
    scoreA: 1, scoreB: 0, expectedVersion: 0, legSubmissionId: submissionId,
    completedLeg: {
      startingThrower: "A", visits: completedVisits, winner: "A", checkoutDartsUsed: 3,
    },
    notes: {}, checkout: { dartsAtDouble: 2, checkoutDartsUsed: 3 },
  });

async function historyAndCount(id: number) {
  const [row] = await query<{ history: any[] | null; submissions: number }>(
    `SELECT n.leg_history AS history,
            (SELECT count(*)::int FROM match_leg_submissions WHERE match_id = $1) AS submissions
       FROM matches m LEFT JOIN match_notes n ON n.match_id = m.id WHERE m.id = $1`, [id],
  );
  return { history: row?.history ?? [], submissions: row?.submissions ?? 0 };
}

async function runCase(name: string, action: () => Promise<void>) {
  try {
    await action();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL: ${name}: ${error instanceof Error ? error.stack : String(error)}`);
  }
}

function socketEvent(socket: Socket, event: string, timeoutMs = 3000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const handler = (value: unknown) => { clearTimeout(timer); resolve(value); };
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`No ${event} event after ${timeoutMs}ms`));
    }, timeoutMs);
    socket.once(event, handler);
  });
}

async function connectSocket(a: Access): Promise<Socket> {
  const socket = io(BASE_URL, {
    path: "/socket.io", transports: ["websocket", "polling"],
    extraHeaders: { cookie: `boardAccessToken=${a.token}` },
    forceNew: true, autoConnect: false, reconnection: false,
  });
  try {
    const connected = socketEvent(socket, "connect", 8000);
    socket.connect();
    await connected;
    return socket;
  } catch (error) {
    socket.disconnect();
    throw error;
  }
}

async function acquireWithNotice(socket: Socket, a: Access, id: number): Promise<boolean> {
  let received = false;
  const handler = (event: { matchId?: number }) => {
    if (event?.matchId === id) received = true;
  };
  socket.on("scorer:ownership-acquired", handler);
  try {
    const response = await acquire(a, id);
    assert.equal(response.status, 200, `ownership acquire failed: ${JSON.stringify(response.body)}`);
    // Start the delivery window AFTER the HTTP response, so a slow request
    // cannot make a working socket look like a missing room subscription.
    await new Promise(resolve => setTimeout(resolve, 1200));
    return received;
  } finally {
    socket.off("scorer:ownership-acquired", handler);
  }
}

async function main() {
  try {
    const [branch] = await query<{ branch_id: string | null }>(
      `SELECT current_setting('neon.branch_id', true) AS branch_id`,
    );
    assert.equal(branch?.branch_id, EXPECTED_BRANCH_ID,
      "Stage 3A database safety guard refused writes: unexpected or unconfirmed Neon development branch");
    const [user] = await query<{ id: number }>(
      `INSERT INTO users (email, password, name)
       VALUES ($1, 'stage3a-disposable-password', $2) RETURNING id`,
      [`${runId}@example.invalid`, runId],
    );
    userId = user.id;

    await runCase("same-session older tab cannot replace a newer unfinished-leg visit", async () => {
      const tid = await tournament("stale");
      const { id } = await match(tid);
      const a = await access(tid); // BOTH requests intentionally use this same cookie.
      assert.equal((await acquire(a, id)).status, 200);
      assert.equal((await saveLeg(a, id, untouched())).status, 200);
      const tabA = (await boardMatch(a, id)).currentLegState;
      const tabB = (await boardMatch(a, id)).currentLegState;
      assert.deepEqual(tabA.visits, tabB.visits);
      assert.equal((await saveLeg(a, id, {
        ...untouched(), remainingA: 441, currentThrower: "B",
        visits: [{ player: "A", score: 60 }],
      })).status, 200);
      const stale = await saveLeg(a, id, tabB);
      const [durable] = await query<{ remaining_a: number; visits: Visit[] }>(
        `SELECT remaining_a, visits FROM scorer_current_legs WHERE match_id = $1`, [id],
      );
      assert.equal(stale.status, 409, `stale snapshot accepted: HTTP ${stale.status}; durable=${JSON.stringify(durable)}`);
      assert.deepEqual([durable.remaining_a, durable.visits], [441, [{ player: "A", score: 60 }]]);
    });

    await runCase("intentional same-session undo persists the prior visit-free state", async () => {
      const tid = await tournament("undo");
      const { id } = await match(tid);
      const a = await access(tid);
      assert.equal((await acquire(a, id)).status, 200);
      assert.equal((await saveLeg(a, id, untouched())).status, 200);
      assert.equal((await saveLeg(a, id, {
        ...untouched(), remainingA: 441, currentThrower: "B",
        visits: [{ player: "A", score: 60 }],
      })).status, 200);
      assert.equal((await saveLeg(a, id, untouched())).status, 200);
      const recovered = (await boardMatch(a, id)).currentLegState;
      assert.deepEqual([recovered.remainingA, recovered.remainingB, recovered.visits,
        recovered.currentThrower, recovered.scoringVersion],
        [501, 501, [], "A", 0]);
    });

    await runCase("board-data recovers untouched, partial, and checkout-ready legs", async () => {
      const tid = await tournament("active-recovery");
      const { id } = await match(tid);
      const a = await access(tid);
      assert.equal((await acquire(a, id)).status, 200);
      assert.equal((await saveLeg(a, id, untouched())).status, 200);
      const initial = await boardMatch(a, id);
      assert.deepEqual([initial.scoreA, initial.scoreB, initial.status, initial.scoringVersion], [0, 0, "IN_PROGRESS", 0]);
      assert.deepEqual([initial.currentLegState.matchId, initial.currentLegState.remainingA,
        initial.currentLegState.remainingB, initial.currentLegState.visits,
        initial.currentLegState.currentThrower, initial.currentLegState.legStartingThrower,
        initial.currentLegState.pendingCheckout], [id, 501, 501, [], "A", "A", null]);

      const partial: Leg = {
        ...untouched(), remainingA: 441, remainingB: 456, currentThrower: "A",
        visits: [{ player: "A", score: 60 }, { player: "B", score: 45 }],
      };
      assert.equal((await saveLeg(a, id, partial)).status, 200);
      const played = (await boardMatch(a, id)).currentLegState;
      assert.deepEqual([played.matchId, played.scoringVersion, played.remainingA, played.remainingB,
        played.currentThrower, played.legStartingThrower, played.visits, played.pendingCheckout],
        [id, 0, 441, 456, "A", "A", partial.visits, null]);

      const stats = { ...emptyStats(), attemptsB: 2, first9PointsA: 360, first9DartsA: 6 };
      assert.equal((await saveLeg(a, id, {
        ...untouched(), remainingA: 0, remainingB: 456, currentThrower: "A",
        visits: [
          { player: "A", score: 180 }, { player: "B", score: 45 },
          { player: "A", score: 180 }, { player: "B", score: 0 },
          { player: "A", score: 141 },
        ],
        pendingCheckout: pending,
      }, stats)).status, 200);
      const [durableBeforeRead] = await query(
        `SELECT scoring_version, remaining_a, remaining_b, current_thrower, visits,
                checkout_stats, pending_checkout, updated_at
           FROM scorer_current_legs WHERE match_id = $1`, [id],
      );
      const checkoutReady = await boardMatch(a, id);
      assert.deepEqual([checkoutReady.scoreA, checkoutReady.scoreB, checkoutReady.status, checkoutReady.scoringVersion], [0, 0, "IN_PROGRESS", 0]);
      const current = checkoutReady.currentLegState;
      assert.deepEqual([current.matchId, current.scoringVersion, current.remainingA, current.remainingB,
        current.currentThrower, current.legStartingThrower], [id, 0, 0, 456, "A", "A"]);
      assert.deepEqual(current.visits, [
        { player: "A", score: 180 }, { player: "B", score: 45 },
        { player: "A", score: 180 }, { player: "B", score: 0 },
        { player: "A", score: 141 },
      ]);
      assert.deepEqual(current.pendingCheckout, pending);
      assert.deepEqual(current.checkoutStats, stats);
      const [durableAfterRead] = await query(
        `SELECT scoring_version, remaining_a, remaining_b, current_thrower, visits,
                checkout_stats, pending_checkout, updated_at
           FROM scorer_current_legs WHERE match_id = $1`, [id],
      );
      assert.deepEqual(durableAfterRead, durableBeforeRead, "recovery read must not change the durable leg");
      // Selected darts-at-double / checkout-darts-used are not fields of the
      // unfinished-leg snapshot; they are submitted only on completion.
      assert.equal((await historyAndCount(id)).history.length, 0);
      assert.equal((await historyAndCount(id)).submissions, 0);
    });

    await runCase("board-data recovers a just-completed leg and a finished match", async () => {
      const tid = await tournament("completed-recovery");
      const { id } = await match(tid);
      const a = await access(tid);
      assert.equal((await acquire(a, id)).status, 200);
      await readyLeg(a, id);
      assert.equal((await submit(a, id, randomUUID())).status, 200);
      const next = await boardMatch(a, id);
      assert.deepEqual([next.scoreA, next.scoreB, next.scoringVersion, next.status], [1, 0, 1, "IN_PROGRESS"]);
      assert.deepEqual([next.currentLegState.matchId, next.currentLegState.scoringVersion,
        next.currentLegState.remainingA, next.currentLegState.remainingB,
        next.currentLegState.currentThrower, next.currentLegState.legStartingThrower,
        next.currentLegState.visits, next.currentLegState.pendingCheckout],
        [id, 1, 501, 501, "B", "B", [], null]);
      assert.equal(next.currentLegState.checkoutStats.attemptsA, 2);
      assert.equal(next.currentLegState.checkoutStats.totalCheckoutDartsUsedA, 3);
      assert.equal(next.notes.legHistory[0].checkoutDartsUsed, 3);
      assert.deepEqual(await historyAndCount(id), {
        history: next.notes.legHistory, submissions: 1,
      });

      const tid2 = await tournament("finished-recovery");
      const final = await match(tid2, { bestOf: 1, roundKey: "F" });
      const b = await access(tid2);
      assert.equal((await acquire(b, final.id)).status, 200);
      await readyLeg(b, final.id);
      assert.equal((await submit(b, final.id, randomUUID())).status, 200);
      const [finishedBeforeRead] = await query(
        `SELECT status, score_a, score_b, scoring_version FROM matches WHERE id = $1`, [final.id],
      );
      const finished = await boardMatch(b, final.id);
      assert.deepEqual([finished.scoreA, finished.scoreB, finished.scoringVersion,
        finished.status, finished.winnerId, finished.currentLegState],
        [1, 0, 1, "COMPLETED", final.a, null]);
      assert.equal(finished.notes.legHistory.length, 1);
      assert.equal(finished.notes.legHistory[0].checkoutDartsUsed, 3);
      assert.deepEqual(await historyAndCount(final.id), { history: finished.notes.legHistory, submissions: 1 });
      const [finishedAfterRead] = await query(
        `SELECT status, score_a, score_b, scoring_version FROM matches WHERE id = $1`, [final.id],
      );
      assert.deepEqual(finishedAfterRead, finishedBeforeRead, "recovery read must not reopen a completed match");
    });

    await runCase("admin reset invalidates the recovered match and board session", async () => {
      const tid = await tournament("admin-reset");
      const { id } = await match(tid);
      const a = await access(tid);
      assert.equal((await acquire(a, id)).status, 200);
      assert.equal((await saveLeg(a, id, {
        ...untouched(), remainingA: 441, currentThrower: "B",
        visits: [{ player: "A", score: 60 }],
      })).status, 200);
      // Same storage boundary used by the authenticated admin reset route,
      // but only for this suite's disposable tournament.
      await storage.resetTournamentData(tid);
      assert.equal((await boardData(a)).status, 401);
      const [counts] = await query<{ matches: number; legs: number }>(
        `SELECT (SELECT count(*)::int FROM matches WHERE tournament_id = $1) AS matches,
                (SELECT count(*)::int FROM scorer_current_legs WHERE match_id = $2) AS legs`, [tid, id],
      );
      assert.deepEqual(counts, { matches: 0, legs: 0 });
    });

    await runCase("lost successful response then fresh board-data keeps exactly one leg", async () => {
      const tid = await tournament("lost-response");
      const { id } = await match(tid);
      const a = await access(tid);
      assert.equal((await acquire(a, id)).status, 200);
      await readyLeg(a, id);
      assert.equal((await submit(a, id, randomUUID())).status, 200);
      // Intentionally discard the response body and the original submission ID.
      const recovered = await boardMatch(a, id);
      assert.deepEqual([recovered.scoreA, recovered.scoreB, recovered.scoringVersion,
        recovered.currentLegState.remainingA, recovered.currentLegState.visits],
        [1, 0, 1, 501, []]);
      const replayWithNewId = await submit(a, id, randomUUID());
      assert.equal(replayWithNewId.status, 409);
      const result = await historyAndCount(id);
      assert.deepEqual([result.history.length, result.submissions], [1, 1]);
    });

    await runCase("post-commit progression resumes after refresh without the lost ID", async () => {
      const tid = await tournament("incomplete-progress");
      const aId = await player(tid, "winner");
      const bId = await player(tid, "loser");
      const finalist = await player(tid, "finalist");
      const source = await match(tid, { a: aId, b: bId, bestOf: 1, roundKey: "R1", order: 0 });
      const target = await match(tid, {
        a: finalist, b: bId, bestOf: 1, roundKey: "F", order: 1,
        status: "PENDING", scoringVersion: 2_147_483_647,
      });
      const a = await access(tid);
      assert.equal((await acquire(a, source.id)).status, 200);
      await readyLeg(a, source.id);
      // Stage 1's disposable maximum-integer target forces progression to fail
      // after the source leg transaction commits.
      const lostId = randomUUID();
      assert.equal((await submit(a, source.id, lostId)).status, 500);
      const [committed] = await query<{ score_a: number; status: string; scoring_version: number; side_effects_completed: boolean }>(
        `SELECT m.score_a, m.status, m.scoring_version, s.side_effects_completed
           FROM matches m JOIN match_leg_submissions s ON s.match_id = m.id
          WHERE m.id = $1 AND s.submission_id = $2`, [source.id, lostId],
      );
      assert.deepEqual(committed, { score_a: 1, status: "COMPLETED", scoring_version: 1, side_effects_completed: false });
      assert.deepEqual([ (await historyAndCount(source.id)).history.length,
        (await historyAndCount(source.id)).submissions ], [1, 1]);
      const [blocked] = await query<{ player_a_id: number }>(`SELECT player_a_id FROM matches WHERE id = $1`, [target.id]);
      assert.equal(blocked.player_a_id, finalist);

      // Repair only the disposable target, just as Stage 1 does; a refresh now
      // has no original in-memory submission ID to replay the accepted request.
      await query(`UPDATE matches SET scoring_version = 0 WHERE id = $1`, [target.id]);
      const recovered = await boardMatch(a, source.id);
      assert.deepEqual([recovered.scoreA, recovered.status, recovered.scoringVersion, recovered.currentLegState],
        [1, "COMPLETED", 1, null]);
      assert.equal(recovered.notes.legHistory.length, 1);
      assert.equal("legSubmissionId" in recovered, false);
      const retryWithNewId = await submit(a, source.id, randomUUID());
      assert.equal(retryWithNewId.status, 409, `new post-refresh ID unexpectedly resumed work: ${JSON.stringify(retryWithNewId.body)}`);
      const [after] = await query<{ player_a_id: number; side_effects_completed: boolean }>(
        `SELECT target.player_a_id, source.side_effects_completed
           FROM matches target CROSS JOIN match_leg_submissions source
          WHERE target.id = $1 AND source.match_id = $2 AND source.submission_id = $3`,
        [target.id, source.id, lostId],
      );
      assert.deepEqual([ (await historyAndCount(source.id)).history.length,
        (await historyAndCount(source.id)).submissions ], [1, 1]);
      assert.deepEqual([after.player_a_id, after.side_effects_completed], [aId, true],
        `progression stayed incomplete after refresh and retry with a new ID: final player=${after.player_a_id}, sideEffectsCompleted=${after.side_effects_completed}`);
    });

    await runCase("socket reconnect rejoins the scorer-session room without an extra join", async () => {
      const tid = await tournament("socket-rejoin");
      const { id } = await match(tid);
      const a = await access(tid);
      const socket = await connectSocket(a);
      try {
        const joined = socketEvent(socket, "board:status");
        socket.emit("join:scorer");
        await joined;
        assert.equal(await acquireWithNotice(socket, a, id), true,
          "initial authenticated join must receive its session-room event");

        const disconnected = socketEvent(socket, "disconnect");
        socket.disconnect();
        await disconnected;
        // Authoritative unfinished-leg state changes while the active scorer
        // is disconnected; no board-data change has triggered its join effect.
        assert.equal((await saveLeg(a, id, {
          ...untouched(), remainingA: 441, currentThrower: "B",
          visits: [{ player: "A", score: 60 }],
        })).status, 200);
        const reconnected = socketEvent(socket, "connect", 8000);
        socket.connect();
        await reconnected;
        // Mirror the existing scorer hook: it emits join:scorer when board-data
        // changes, not from its connect handler.
        const deliveredWithoutJoin = await acquireWithNotice(socket, a, id);
        if (!deliveredWithoutJoin) {
          const joinedAgain = socketEvent(socket, "board:status");
          socket.emit("join:scorer");
          await joinedAgain;
          assert.equal(await acquireWithNotice(socket, a, id), true,
            "manual rejoin control must prove the server can deliver after reconnect");
        }
        assert.equal(deliveredWithoutJoin, true,
          "reconnected scorer must receive its session-room event without waiting for board-data to change");
      } finally {
        socket.disconnect();
      }
    });

    await runCase("server rejects displaced owner and stale version after reconnect", async () => {
      const tid = await tournament("socket-server-protection");
      const { id } = await match(tid);
      const a = await access(tid);
      const b = await access(tid);
      assert.equal((await acquire(a, id)).status, 200);
      const socket = await connectSocket(a);
      try {
        const disconnected = socketEvent(socket, "disconnect");
        socket.disconnect();
        await disconnected;
        assert.equal((await acquire(b, id, true)).status, 200);
        await readyLeg(b, id);
        assert.equal((await submit(b, id, randomUUID())).status, 200);
        const reconnected = socketEvent(socket, "connect", 8000);
        socket.connect();
        await reconnected;
        const displaced = await saveLeg(a, id, { ...untouched(), scoringVersion: 1 });
        assert.equal(displaced.status, 409);
        assert.equal(displaced.body.code, "SCORER_LEASE_SESSION_MISMATCH");
        const staleVersion = await saveLeg(b, id, untouched());
        assert.equal(staleVersion.status, 409);
        assert.equal(staleVersion.body.code, "STALE_SCORING_VERSION");
        assert.equal((await boardMatch(a, id)).ownership.ownedByCurrentSession, false);
        const result = await historyAndCount(id);
        assert.deepEqual([result.history.length, result.submissions], [1, 1]);
      } finally {
        socket.disconnect();
      }
    });
  } finally {
    if (userId !== null) {
      await query(`DELETE FROM users WHERE id = $1`, [userId]);
      const [remaining] = await query<{ count: number }>(
        `SELECT count(*)::int AS count FROM tournaments WHERE name LIKE $1`, [`${runId}%`],
      );
      assert.equal(remaining.count, 0, "Stage 3A disposable tournament cleanup failed");
    }
    await pool.end();
  }
  console.log(`STAGE3A_DB_SUMMARY=${JSON.stringify({ passed, failed, total: passed + failed })}`);
  if (failed) process.exitCode = 1;
}

main().catch(error => {
  console.error(`FAIL: Stage 3A setup/guard/cleanup: ${error instanceof Error ? error.stack : String(error)}`);
  process.exitCode = 1;
});