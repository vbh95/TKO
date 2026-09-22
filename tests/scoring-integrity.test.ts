import test from "node:test";
import assert from "node:assert/strict";
import {
  isExactlyOneLegAdvance,
  isSavedStateCompatible,
} from "../shared/scoring-integrity";
import {
  assertExpectedScoringVersion,
  assertIdempotentReplayMatches,
  ScoringConflictError,
  validateOneLegAdvance,
} from "../server/scoring-integrity";

test("normal scorer transition accepts exactly one Player A leg", () => {
  assert.doesNotThrow(() => validateOneLegAdvance(0, 0, 1, 0, 3));
  assert.equal(isExactlyOneLegAdvance(0, 0, 1, 0), true);
});

test("normal scorer transition accepts exactly one Player B leg", () => {
  assert.doesNotThrow(() => validateOneLegAdvance(1, 0, 1, 1, 5));
  assert.equal(isExactlyOneLegAdvance(1, 0, 1, 1), true);
});

test("score jumps are rejected", () => {
  assert.throws(
    () => validateOneLegAdvance(0, 0, 2, 0, 3),
    (error: unknown) => error instanceof ScoringConflictError && error.code === "INVALID_SCORE_JUMP",
  );
  assert.throws(
    () => validateOneLegAdvance(1, 0, 3, 0, 7),
    (error: unknown) => error instanceof ScoringConflictError && error.code === "INVALID_SCORE_JUMP",
  );
});

test("score decreases are rejected", () => {
  assert.throws(
    () => validateOneLegAdvance(1, 0, 0, 0, 3),
    (error: unknown) => error instanceof ScoringConflictError && error.code === "SCORE_DECREASE",
  );
});

test("same submission ID with the same payload is a valid idempotent replay", () => {
  const payload = {
    scoreA: 1,
    scoreB: 0,
    expectedVersion: 0,
    completedLeg: { winner: "A", visits: [{ player: "A", score: 501 }] },
  };
  assert.doesNotThrow(() => assertIdempotentReplayMatches(payload, payload, { id: 1 }));
});

test("same submission ID cannot be reused with different data", () => {
  assert.throws(
    () => assertIdempotentReplayMatches(
      { scoreA: 1, scoreB: 0 },
      { scoreA: 0, scoreB: 1 },
      { id: 1 },
    ),
    (error: unknown) => error instanceof ScoringConflictError && error.code === "SUBMISSION_ID_REUSED",
  );
});

test("stale concurrent version is rejected", () => {
  assert.doesNotThrow(() => assertExpectedScoringVersion(4, 4, { id: 1 }));
  assert.throws(
    () => assertExpectedScoringVersion(5, 4, { id: 1 }),
    (error: unknown) => error instanceof ScoringConflictError && error.code === "STALE_SCORING_VERSION",
  );
});

test("stale local scorer state is rejected but matching unfinished-leg state restores", () => {
  const match = {
    id: 10,
    playerAId: 1,
    playerBId: 2,
    bestOf: 3,
    scoreA: 1,
    scoreB: 0,
    scoringVersion: 7,
  };
  const saved = {
    matchId: 10,
    playerAId: 1,
    playerBId: 2,
    bestOf: 3,
    serverScoreA: 1,
    serverScoreB: 0,
    legsWonA: 1,
    legsWonB: 0,
    scoringVersion: 7,
  };

  assert.equal(isSavedStateCompatible(saved, match), true);
  assert.equal(isSavedStateCompatible(saved, { ...match, scoreA: 0, scoringVersion: 8 }), false);
  assert.equal(isSavedStateCompatible(saved, { ...match, playerBId: 3 }), false);
  assert.equal(isSavedStateCompatible(saved, { ...match, bestOf: 5 }), false);
});