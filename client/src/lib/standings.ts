type MatchLike = {
  playerAId: number | null;
  playerBId: number | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: number | null;
  status: string;
};

type PlayerLike = {
  id: number;
  [key: string]: any;
};

export type StandingEntry = PlayerLike & {
  played: number;
  won: number;
  lost: number;
  legsFor: number;
  legsAgainst: number;
  diff: number;
  pts: number;
};

function computeStats<P extends PlayerLike>(
  playerList: P[],
  completedMatches: MatchLike[],
  ptsWin: number,
  ptsLoss: number,
): StandingEntry[] {
  return playerList.map(player => {
    const playerMatches = completedMatches.filter(m =>
      (m.playerAId === player.id || m.playerBId === player.id)
    );
    let played = 0, won = 0, lost = 0, legsFor = 0, legsAgainst = 0;
    playerMatches.forEach(m => {
      played++;
      const isA = m.playerAId === player.id;
      const myScore = isA ? (m.scoreA || 0) : (m.scoreB || 0);
      const oppScore = isA ? (m.scoreB || 0) : (m.scoreA || 0);
      legsFor += myScore;
      legsAgainst += oppScore;
      if (m.winnerId === player.id) won++;
      else lost++;
    });
    const pts = won * ptsWin + lost * ptsLoss;
    const diff = legsFor - legsAgainst;
    return { ...player, played, won, lost, legsFor, legsAgainst, diff, pts };
  });
}

function tryHeadToHead(
  tiedGroup: StandingEntry[],
  completedMatches: MatchLike[],
  ptsWin: number,
  ptsLoss: number,
): StandingEntry[] | null {
  const tiedIds = new Set(tiedGroup.map(p => p.id));
  const h2hMatches = completedMatches.filter(m =>
    m.playerAId !== null && m.playerBId !== null &&
    tiedIds.has(m.playerAId) && tiedIds.has(m.playerBId)
  );

  const expectedPairings = tiedGroup.length * (tiedGroup.length - 1) / 2;
  const pairings = new Set<string>();
  h2hMatches.forEach(m => {
    const pair = [m.playerAId!, m.playerBId!].sort((a, b) => a - b).join('-');
    pairings.add(pair);
  });

  if (pairings.size < expectedPairings) return null;

  const matchCounts = new Map<number, number>();
  tiedGroup.forEach(p => matchCounts.set(p.id, 0));
  h2hMatches.forEach(m => {
    matchCounts.set(m.playerAId!, (matchCounts.get(m.playerAId!) || 0) + 1);
    matchCounts.set(m.playerBId!, (matchCounts.get(m.playerBId!) || 0) + 1);
  });
  const counts = Array.from(matchCounts.values());
  if (!counts.every(c => c === counts[0])) return null;

  const h2hStats = computeStats(tiedGroup, h2hMatches, ptsWin, ptsLoss);
  h2hStats.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.diff !== a.diff) return b.diff - a.diff;
    if (b.legsFor !== a.legsFor) return b.legsFor - a.legsFor;
    return a.id - b.id;
  });

  return h2hStats.map(h => tiedGroup.find(p => p.id === h.id)!);
}

export function calcStandings<P extends PlayerLike>(
  playerList: P[],
  matchList: MatchLike[],
  ptsWin: number,
  ptsLoss: number,
): StandingEntry[] {
  const completedMatches = matchList.filter(m => m.status === 'COMPLETED');
  const stats = computeStats(playerList, completedMatches, ptsWin, ptsLoss);

  stats.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.diff !== a.diff) return b.diff - a.diff;
    if (b.legsFor !== a.legsFor) return b.legsFor - a.legsFor;
    if (a.played !== b.played) return a.played - b.played;
    return a.id - b.id;
  });

  let i = 0;
  while (i < stats.length) {
    let j = i + 1;
    while (
      j < stats.length &&
      stats[j].pts === stats[i].pts &&
      stats[j].diff === stats[i].diff &&
      stats[j].legsFor === stats[i].legsFor
    ) {
      j++;
    }
    if (j - i > 1) {
      const tiedGroup = stats.slice(i, j);
      const resolved = tryHeadToHead(tiedGroup, completedMatches, ptsWin, ptsLoss);
      if (resolved) {
        for (let k = 0; k < resolved.length; k++) {
          stats[i + k] = resolved[k];
        }
      }
    }
    i = j;
  }

  return stats;
}
