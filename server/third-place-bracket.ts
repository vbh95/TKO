export type ThirdPlaceBracketMatch = {
  id: number;
  stage?: string;
  roundKey: string;
  order: number;
  playerAId: number | null;
  playerBId: number | null;
  scoreA: number;
  scoreB: number;
  bestOf: number;
  status: string;
  winnerId: number | null;
  boardNumber?: number | null;
};

export type ThirdPlaceMatchUpdate = {
  matchId: number;
  updates: Partial<ThirdPlaceBracketMatch>;
};

export type ThirdPlaceGroup = { id: number };
export type ThirdPlacePlayer = { id: number };
export type ThirdPlaceMembership = { groupId: number; playerId: number };
export type ThirdPlaceGroupMatch = {
  groupId: number | null;
  playerAId: number | null;
  playerBId: number | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: number | null;
  status: string;
};

export type ThirdPlaceSettings = {
  groupScheduleMode?: "standard" | "board_rotation";
  numberOfBoards?: number;
};

export function getThirdPlaceBracketRounds(qualifierCount: number): Array<{
  roundKey: string;
  matchCount: number;
}> {
  if (!Number.isInteger(qualifierCount) || qualifierCount < 2) return [];

  let slots = 1;
  while (slots < qualifierCount) slots *= 2;

  const rounds: Array<{ roundKey: string; matchCount: number }> = [];
  for (let round = 0; round < Math.log2(slots); round++) {
    const matchCount = slots / Math.pow(2, round + 1);
    const roundKey = matchCount === 1
      ? "TP_F"
      : matchCount === 2
        ? "TP_SF"
        : matchCount === 4
          ? "TP_QF"
          : `TP_R${round + 1}`;
    rounds.push({ roundKey, matchCount });
  }
  return rounds;
}

export function getThirdPlaceSeedUpdates(
  matches: ThirdPlaceBracketMatch[],
  qualifierIds: number[],
): ThirdPlaceMatchUpdate[] {
  const sorted = matches
    .filter(match => match.roundKey.startsWith("TP_"))
    .sort((a, b) => a.order - b.order);
  const firstRoundKey = sorted[0]?.roundKey;
  const firstRound = sorted.filter(match => match.roundKey === firstRoundKey);
  if (firstRound.length === 0 || qualifierIds.length < 2) return [];

  const fullMatches = Math.max(0, qualifierIds.length - firstRound.length);
  const updates: ThirdPlaceMatchUpdate[] = [];

  for (let i = 0; i < firstRound.length; i++) {
    const isFullMatch = i < fullMatches;
    const playerAId = isFullMatch
      ? qualifierIds[i * 2]
      : qualifierIds[fullMatches + i];
    const playerBId = isFullMatch ? qualifierIds[i * 2 + 1] : null;
    if (playerAId === undefined) continue;

    updates.push({
      matchId: firstRound[i].id,
      updates: playerBId === null
        ? {
            playerAId,
            playerBId: null,
            scoreA: 1,
            scoreB: 0,
            bestOf: 1,
            winnerId: playerAId,
            status: "COMPLETED",
          }
        : {
            playerAId,
            playerBId,
            scoreA: 0,
            scoreB: 0,
            winnerId: null,
            status: "PENDING",
          },
    });
  }
  return updates;
}

export function getThirdPlaceProgressionUpdate(
  matches: ThirdPlaceBracketMatch[],
  sourceMatchId: number,
  winnerId: number | null,
): ThirdPlaceMatchUpdate | null {
  return getKnockoutProgressionUpdate(matches, sourceMatchId, winnerId, true);
}

export function getKnockoutProgressionUpdate(
  matches: ThirdPlaceBracketMatch[],
  sourceMatchId: number,
  winnerId: number | null,
  thirdPlaceBracket: boolean,
): ThirdPlaceMatchUpdate | null {
  const sorted = matches
    .filter(match => match.roundKey.startsWith("TP_") === thirdPlaceBracket)
    .sort((a, b) => a.order - b.order);
  const source = sorted.find(match => match.id === sourceMatchId);
  if (!source) return null;

  const roundKeys = Array.from(new Set(sorted.map(match => match.roundKey)));
  const roundIndex = roundKeys.indexOf(source.roundKey);
  if (roundIndex < 0 || roundIndex >= roundKeys.length - 1) return null;

  const sourceRound = sorted.filter(match => match.roundKey === source.roundKey);
  const sourceIndex = sourceRound.findIndex(match => match.id === sourceMatchId);
  if (sourceIndex < 0) return null;

  const nextRound = sorted.filter(match => match.roundKey === roundKeys[roundIndex + 1]);
  const nextMatch = nextRound[Math.floor(sourceIndex / 2)];
  if (!nextMatch) return null;

  const isTop = sourceIndex % 2 === 0;
  const currentPlayerId = isTop ? nextMatch.playerAId : nextMatch.playerBId;
  if (currentPlayerId === winnerId) return null;

  return {
    matchId: nextMatch.id,
    updates: {
      ...(isTop ? { playerAId: winnerId } : { playerBId: winnerId }),
      winnerId: null,
      status: "PENDING",
      scoreA: 0,
      scoreB: 0,
    },
  };
}

export function getThirdPlaceByeProgressionUpdates(
  matches: ThirdPlaceBracketMatch[],
  seededMatchIds: number[],
): ThirdPlaceMatchUpdate[] {
  const localMatches = matches.map(match => ({ ...match }));
  const updates: ThirdPlaceMatchUpdate[] = [];

  for (const matchId of seededMatchIds) {
    const source = localMatches.find(match => match.id === matchId);
    if (!source?.winnerId || source.status !== "COMPLETED") continue;
    const progression = getThirdPlaceProgressionUpdate(localMatches, matchId, source.winnerId);
    if (!progression) continue;
    const target = localMatches.find(match => match.id === progression.matchId);
    if (!target) continue;
    Object.assign(target, progression.updates);
    updates.push(progression);
  }
  return updates;
}

export function usesThirdPlaceBoardSplit(
  groupCount: number,
  settings: ThirdPlaceSettings,
): boolean {
  const boards = settings.numberOfBoards || 0;
  return settings.groupScheduleMode === "board_rotation" &&
    boards >= 2 &&
    boards % 2 === 0 &&
    groupCount === boards * 2;
}

export function getThirdPlaceBoardNumber(
  roundMatchIndex: number,
  groupCount: number,
  settings: ThirdPlaceSettings,
): number {
  const boards = settings.numberOfBoards || 0;
  if (
    settings.groupScheduleMode === "board_rotation" &&
    boards > 0 &&
    groupCount === boards * 2
  ) {
    if (usesThirdPlaceBoardSplit(groupCount, settings)) {
      const halfBoards = boards / 2;
      return (roundMatchIndex % halfBoards) + halfBoards + 1;
    }
    return (roundMatchIndex % boards) + 1;
  }
  return (roundMatchIndex % Math.max(1, groupCount)) + 1;
}

export function getThirdPlaceQualifierIds(
  groups: ThirdPlaceGroup[],
  memberships: ThirdPlaceMembership[],
  players: ThirdPlacePlayer[],
  matches: ThirdPlaceGroupMatch[],
  pointsForWin: number,
  pointsForLoss: number,
): number[] {
  const sortedGroups = [...groups].sort((a, b) => a.id - b.id);
  const qualifiers: number[] = [];

  for (const group of sortedGroups) {
    const groupPlayerIds = memberships
      .filter(membership => membership.groupId === group.id)
      .map(membership => membership.playerId);
    const groupPlayers = players.filter(player => groupPlayerIds.includes(player.id));
    const groupMatches = matches.filter(match =>
      match.groupId === group.id && match.status === "COMPLETED",
    );

    const standings = groupPlayers.map(player => {
      const playerMatches = groupMatches.filter(match =>
        match.playerAId === player.id || match.playerBId === player.id,
      );
      let played = 0;
      let won = 0;
      let legsFor = 0;
      let legsAgainst = 0;
      for (const match of playerMatches) {
        played++;
        const isA = match.playerAId === player.id;
        legsFor += isA ? (match.scoreA || 0) : (match.scoreB || 0);
        legsAgainst += isA ? (match.scoreB || 0) : (match.scoreA || 0);
        if (match.winnerId === player.id) won++;
      }
      return {
        id: player.id,
        played,
        pts: won * pointsForWin + (played - won) * pointsForLoss,
        legsFor,
        diff: legsFor - legsAgainst,
      };
    });

    standings.sort((a, b) =>
      b.pts - a.pts ||
      b.diff - a.diff ||
      b.legsFor - a.legsFor ||
      a.id - b.id,
    );

    let i = 0;
    while (i < standings.length) {
      let j = i + 1;
      while (
        j < standings.length &&
        standings[j].pts === standings[i].pts &&
        standings[j].diff === standings[i].diff &&
        standings[j].legsFor === standings[i].legsFor
      ) {
        j++;
      }

      if (j - i > 1) {
        const tied = standings.slice(i, j);
        const tiedIds = new Set(tied.map(player => player.id));
        const headToHead = groupMatches.filter(match =>
          match.playerAId !== null &&
          match.playerBId !== null &&
          tiedIds.has(match.playerAId) &&
          tiedIds.has(match.playerBId),
        );
        const expectedPairings = tied.length * (tied.length - 1) / 2;
        const pairings = new Set(headToHead.map(match =>
          [match.playerAId, match.playerBId].sort((a, b) => a! - b!).join("-"),
        ));
        let resolved = false;

        if (pairings.size >= expectedPairings) {
          const matchCounts = new Map(tied.map(player => [player.id, 0]));
          for (const match of headToHead) {
            if (match.playerAId !== null) {
              matchCounts.set(match.playerAId, (matchCounts.get(match.playerAId) || 0) + 1);
            }
            if (match.playerBId !== null) {
              matchCounts.set(match.playerBId, (matchCounts.get(match.playerBId) || 0) + 1);
            }
          }
          const counts = Array.from(matchCounts.values());
          if (counts.every(count => count === counts[0])) {
            const headToHeadStandings = tied.map(player => {
              const playerMatches = headToHead.filter(match =>
                match.playerAId === player.id || match.playerBId === player.id,
              );
              let h2hWon = 0;
              let h2hFor = 0;
              let h2hAgainst = 0;
              for (const match of playerMatches) {
                const isA = match.playerAId === player.id;
                h2hFor += isA ? (match.scoreA || 0) : (match.scoreB || 0);
                h2hAgainst += isA ? (match.scoreB || 0) : (match.scoreA || 0);
                if (match.winnerId === player.id) h2hWon++;
              }
              return {
                id: player.id,
                pts: h2hWon * pointsForWin,
                diff: h2hFor - h2hAgainst,
                legsFor: h2hFor,
                played: player.played,
              };
            });
            headToHeadStandings.sort((a, b) =>
              b.pts - a.pts ||
              b.diff - a.diff ||
              b.legsFor - a.legsFor ||
              a.played - b.played ||
              a.id - b.id,
            );
            const reordered = headToHeadStandings.map(player =>
              tied.find(tiedPlayer => tiedPlayer.id === player.id)!,
            );
            for (let k = 0; k < reordered.length; k++) standings[i + k] = reordered[k];
            resolved = true;
          }
        }

        if (!resolved) {
          const fallback = [...tied].sort((a, b) => a.played - b.played || a.id - b.id);
          for (let k = 0; k < fallback.length; k++) standings[i + k] = fallback[k];
        }
      }
      i = j;
    }

    const thirdPlaceId = standings[2]?.id;
    if (thirdPlaceId !== undefined) qualifiers.push(thirdPlaceId);
  }
  return qualifiers;
}

export function shouldCompleteTournament(
  matches: Array<Pick<ThirdPlaceBracketMatch, "stage" | "roundKey" | "status">>,
  thirdPlaceEnabled: boolean,
): boolean {
  if (matches.length === 0) return false;

  if (matches.every(match => match.stage === "GROUP")) {
    return matches.every(match => match.status === "COMPLETED");
  }

  const grandFinals = matches.filter(match =>
    match.stage === "GRAND_FINAL" ||
    (match.stage === "KNOCKOUT" && match.roundKey === "GF"),
  );
  const mainFinals = grandFinals.length > 0
    ? grandFinals
    : matches.filter(match =>
        match.stage === "KNOCKOUT" && match.roundKey === "F",
      );
  if (mainFinals.length === 0 || !mainFinals.every(match => match.status === "COMPLETED")) {
    return false;
  }

  if (!thirdPlaceEnabled) return true;
  const thirdPlaceFinals = matches.filter(match =>
    match.stage === "KNOCKOUT" && match.roundKey === "TP_F",
  );
  return thirdPlaceFinals.length > 0 &&
    thirdPlaceFinals.every(match => match.status === "COMPLETED");
}
