export type AuthoritativeMatchIdentity = {
  id: number;
  playerAId: number | null;
  playerBId: number | null;
  bestOf: number;
  scoreA: number | null;
  scoreB: number | null;
  scoringVersion: number;
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
    saved.scoringVersion === (match.scoringVersion || 0)
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