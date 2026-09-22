import { isExactlyOneLegAdvance } from "@shared/scoring-integrity";

export class ScoringConflictError extends Error {
  constructor(
    message: string,
    public readonly currentMatch: unknown,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ScoringConflictError";
  }
}

export class ScoringValidationError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "ScoringValidationError";
  }
}

export function assertExpectedScoringVersion(
  currentVersion: number,
  expectedVersion: number,
  currentMatch: unknown,
): void {
  if (currentVersion !== expectedVersion) {
    throw new ScoringConflictError(
      "The match was updated by another request",
      currentMatch,
      "STALE_SCORING_VERSION",
    );
  }
}

export function assertIdempotentReplayMatches(
  existingPayload: unknown,
  requestPayload: unknown,
  currentMatch: unknown,
): void {
  if (JSON.stringify(existingPayload) !== JSON.stringify(requestPayload)) {
    throw new ScoringConflictError(
      "This leg submission ID was already used with different data",
      currentMatch,
      "SUBMISSION_ID_REUSED",
    );
  }
}

export function validateOneLegAdvance(
  previousScoreA: number,
  previousScoreB: number,
  requestedScoreA: number,
  requestedScoreB: number,
  bestOf: number,
): void {
  if (![previousScoreA, previousScoreB, requestedScoreA, requestedScoreB].every(Number.isInteger)) {
    throw new ScoringValidationError("Scores must be whole numbers", "INVALID_SCORE");
  }
  if (requestedScoreA < previousScoreA || requestedScoreB < previousScoreB) {
    throw new ScoringConflictError("Scorer results cannot decrease a score", null, "SCORE_DECREASE");
  }

  if (!isExactlyOneLegAdvance(previousScoreA, previousScoreB, requestedScoreA, requestedScoreB)) {
    throw new ScoringConflictError(
      "A scorer submission must add exactly one completed leg",
      null,
      "INVALID_SCORE_JUMP",
    );
  }

  const legsToWin = Math.ceil(bestOf / 2);
  if (requestedScoreA > legsToWin || requestedScoreB > legsToWin) {
    throw new ScoringValidationError("Score exceeds the match format", "SCORE_EXCEEDS_FORMAT");
  }
}