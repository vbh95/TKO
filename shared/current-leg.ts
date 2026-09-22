export type ScorerVisit = {
  player: "A" | "B";
  score: number;
};

export type ScorerCheckoutStats = {
  attemptsA: number;
  attemptsB: number;
  successA: number;
  successB: number;
  finishA: number;
  finishB: number;
  first9PointsA: number;
  first9DartsA: number;
  first9PointsB: number;
  first9DartsB: number;
  totalCheckoutDartsUsedA: number;
  totalCheckoutDartsUsedB: number;
};

export type ScorerPendingCheckout = {
  player: "A" | "B";
  newLegsA: number;
  newLegsB: number;
  checkoutScore: number;
};

export type DurableCurrentLegState = {
  matchId: number;
  scoringVersion: number;
  remainingA: number;
  remainingB: number;
  currentThrower: "A" | "B";
  legStartingThrower: "A" | "B";
  visits: ScorerVisit[];
  checkoutStats: ScorerCheckoutStats;
  pendingCheckout: ScorerPendingCheckout | null;
  swapPlayers: boolean;
  updatedAt: Date | string;
};

export function emptyScorerCheckoutStats(): ScorerCheckoutStats {
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