export type AuthoritativeMatchIdentity = {
  id: number;
  playerAId: number | null;
  playerBId: number | null;
  bestOf: number;
  scoreA: number | null;
  scoreB: number | null;
  scoringVersion: number;
  status: string;
};

export type SavedScorerIdentity = {
  matchId: number;
  playerAId: number | null;
  playerBId: number | null;
  bestOf: number;
  serverScoreA: number;
  serverScoreB: number;
  legsWonA: number;
  legsWonB: number;
  scoringVersion: number;
  status: string;
};

export function isSavedStateCompatible(
  saved: SavedScorerIdentity,
  match: AuthoritativeMatchIdentity,
): boolean {
  return (
    saved.matchId === match.id &&
    saved.playerAId === match.playerAId &&
    saved.playerBId === match.playerBId &&
    saved.bestOf === (match.bestOf || 3) &&
    saved.serverScoreA === (match.scoreA || 0) &&
    saved.serverScoreB === (match.scoreB || 0) &&
    saved.legsWonA === (match.scoreA || 0) &&
    saved.legsWonB === (match.scoreB || 0) &&
    saved.scoringVersion === (match.scoringVersion || 0) &&
    saved.status === match.status
  );
}

export function isExactlyOneLegAdvance(
  previousScoreA: number,
  previousScoreB: number,
  requestedScoreA: number,
  requestedScoreB: number,
): boolean {
  const deltaA = requestedScoreA - previousScoreA;
  const deltaB = requestedScoreB - previousScoreB;
  return (deltaA === 1 && deltaB === 0) || (deltaA === 0 && deltaB === 1);
}

export function canonicalizeForComparison(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeForComparison);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, canonicalizeForComparison(nested)]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalizeForComparison(value));
}