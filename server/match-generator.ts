import type { Player, TournamentSettings } from "@shared/schema";
import { storage } from "./storage";

function groupLabel(index: number): string {
  return `Group ${String.fromCharCode(65 + index)}`;
}

function getRoundKey(totalSlots: number, currentRound: number): string {
  const matchesInRound = totalSlots / Math.pow(2, currentRound + 1);
  if (matchesInRound === 1) return "F";
  if (matchesInRound === 2) return "SF";
  if (matchesInRound === 4) return "QF";
  if (matchesInRound === 8) return "R16";
  if (matchesInRound === 16) return "R32";
  return `R${currentRound + 1}`;
}

function getBestOfForRound(roundKey: string, settings: TournamentSettings): number {
  if (settings.knockoutBestOfByRound) {
    if (roundKey === "R16" && settings.knockoutBestOfByRound.lastSixteen) return settings.knockoutBestOfByRound.lastSixteen;
    if (roundKey === "QF" && settings.knockoutBestOfByRound.quarterFinal) return settings.knockoutBestOfByRound.quarterFinal;
    if (roundKey === "SF" && settings.knockoutBestOfByRound.semiFinal) return settings.knockoutBestOfByRound.semiFinal;
    if (roundKey === "F" && settings.knockoutBestOfByRound.final) return settings.knockoutBestOfByRound.final;
  }
  return settings.knockoutBestOf || 3;
}

function getTpRoundKey(totalSlots: number, round: number): string {
  const matchesInRound = totalSlots / Math.pow(2, round + 1);
  if (matchesInRound === 1) return "TP_F";
  if (matchesInRound === 2) return "TP_SF";
  if (matchesInRound === 4) return "TP_QF";
  return `TP_R${round + 1}`;
}

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

type ScheduledMatch = { playerA: Player; playerB: Player; round: number };

function assignScorersToMatches(
  scheduled: ScheduledMatch[],
  groupPlayers: Player[]
): (number | null)[] {
  if (groupPlayers.length < 3) {
    return new Array(scheduled.length).fill(null);
  }

  const scorerCounts = new Map<number, number>();
  for (const p of groupPlayers) {
    scorerCounts.set(p.id, 0);
  }

  const scorerIds: (number | null)[] = new Array(scheduled.length).fill(null);

  let previousScorerId: number | null = null;

  for (let i = 0; i < scheduled.length; i++) {
    const current = scheduled[i];
    const ineligible = new Set<number>();
    ineligible.add(current.playerA.id);
    ineligible.add(current.playerB.id);

    const nextMatch = i + 1 < scheduled.length ? scheduled[i + 1] : null;
    if (nextMatch) {
      ineligible.add(nextMatch.playerA.id);
      ineligible.add(nextMatch.playerB.id);
    }

    if (previousScorerId !== null) {
      ineligible.add(previousScorerId);
    }

    let eligible = groupPlayers.filter(p => !ineligible.has(p.id));

    if (eligible.length === 0) {
      eligible = groupPlayers.filter(
        p => p.id !== current.playerA.id && p.id !== current.playerB.id
      );
    }

    if (eligible.length === 0) continue;

    const minCount = Math.min(...eligible.map(p => scorerCounts.get(p.id)!));
    const candidates = eligible.filter(p => scorerCounts.get(p.id)! === minCount);
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    scorerIds[i] = chosen.id;
    scorerCounts.set(chosen.id, scorerCounts.get(chosen.id)! + 1);
    previousScorerId = chosen.id;
  }

  return scorerIds;
}

function generateRoundRobinSchedule(players: Player[]): ScheduledMatch[] {
  if (players.length < 2) return [];

  const list: (Player | null)[] = [...players];
  if (list.length % 2 !== 0) list.push(null);

  const n = list.length;
  const rounds: { playerA: Player; playerB: Player; origRound: number }[][] = [];

  const fixed = list[0];
  const rotating = list.slice(1);

  for (let r = 0; r < n - 1; r++) {
    const round: { playerA: Player; playerB: Player; origRound: number }[] = [];
    const current = [fixed, ...rotating];

    for (let i = 0; i < n / 2; i++) {
      const a = current[i];
      const b = current[n - 1 - i];
      if (a && b) round.push({ playerA: a, playerB: b, origRound: r });
    }
    rounds.push(round);

    rotating.push(rotating.shift()!);
  }

  const allMatches = rounds.flat();
  return scheduleNoBackToBack(allMatches);
}

function scheduleNoBackToBack(
  allMatches: { playerA: Player; playerB: Player; origRound: number }[]
): ScheduledMatch[] {
  const used: boolean[] = new Array(allMatches.length).fill(false);
  const scheduled: ScheduledMatch[] = [];
  let lastPlayerA = -1;
  let lastPlayerB = -1;
  let usedCount = 0;

  const totalRounds = Math.max(...allMatches.map(m => m.origRound)) + 1;
  const matchesPerRound = allMatches.filter(m => m.origRound === 0).length;
  let currentScheduledRound = 1;
  let matchesInCurrentRound = 0;

  while (usedCount < allMatches.length) {
    let bestIdx = -1;
    let bestOverlap = Infinity;

    for (let idx = 0; idx < allMatches.length; idx++) {
      if (used[idx]) continue;
      const m = allMatches[idx];
      const overlap =
        (m.playerA.id === lastPlayerA || m.playerA.id === lastPlayerB ? 1 : 0) +
        (m.playerB.id === lastPlayerA || m.playerB.id === lastPlayerB ? 1 : 0);
      if (overlap < bestOverlap) {
        bestOverlap = overlap;
        bestIdx = idx;
        if (overlap === 0) break;
      }
    }

    used[bestIdx] = true;
    usedCount++;
    const match = allMatches[bestIdx];
    scheduled.push({ playerA: match.playerA, playerB: match.playerB, round: currentScheduledRound });
    lastPlayerA = match.playerA.id;
    lastPlayerB = match.playerB.id;

    matchesInCurrentRound++;
    if (matchesInCurrentRound >= matchesPerRound) {
      matchesInCurrentRound = 0;
      currentScheduledRound++;
    }
  }

  return scheduled;
}

function createSeededOrder(players: Player[]): (Player | null)[] {
  const sorted = [...players].sort((a, b) => (a.seed || 999) - (b.seed || 999));
  const totalSlots = nextPowerOfTwo(sorted.length);
  const bracket: (Player | null)[] = new Array(totalSlots).fill(null);

  for (let i = 0; i < sorted.length; i++) {
    bracket[i] = sorted[i];
  }

  if (totalSlots <= 2) return bracket;

  const seeded: (Player | null)[] = new Array(totalSlots).fill(null);
  const positions = getSeededPositions(totalSlots);
  for (let i = 0; i < totalSlots; i++) {
    seeded[positions[i]] = bracket[i];
  }
  return seeded;
}

function getSeededPositions(size: number): number[] {
  if (size === 1) return [0];
  if (size === 2) return [0, 1];

  const half = getSeededPositions(size / 2);
  const result: number[] = [];
  for (const pos of half) {
    result.push(pos * 2);
    result.push(size - 1 - pos * 2);
  }
  return result;
}

export async function generateRoundRobinMatches(
  tournamentId: number,
  players: Player[],
  settings: TournamentSettings
): Promise<void> {
  const groupCount = settings.groupCount || 1;
  const bestOf = settings.groupBestOf || 3;

  const playersPerGroup = Math.ceil(players.length / groupCount);
  const groupArrays: Player[][] = [];

  for (let g = 0; g < groupCount; g++) {
    groupArrays.push(players.slice(g * playersPerGroup, (g + 1) * playersPerGroup));
  }

  let matchOrder = 0;

  for (let g = 0; g < groupArrays.length; g++) {
    const groupPlayers = groupArrays[g];
    if (groupPlayers.length === 0) continue;

    const group = await storage.createGroup({
      tournamentId,
      name: groupLabel(g),
    });

    for (const player of groupPlayers) {
      await storage.createGroupMembership({
        groupId: group.id,
        playerId: player.id,
      });
    }

    const scheduled = generateRoundRobinSchedule(groupPlayers);
    const scorerIds = assignScorersToMatches(scheduled, groupPlayers);
    for (let i = 0; i < scheduled.length; i++) {
      const sm = scheduled[i];
      const scorer = scorerIds[i] ? groupPlayers.find(p => p.id === scorerIds[i]) : null;
      await storage.createMatch({
        tournamentId,
        stage: "GROUP",
        roundKey: `R${sm.round}`,
        groupId: group.id,
        playerAId: sm.playerA.id,
        playerBId: sm.playerB.id,
        scoreA: 0,
        scoreB: 0,
        bestOf,
        status: "PENDING",
        winnerId: null,
        order: matchOrder++,
        scorerId: scorerIds[i],
        scorerName: scorer?.name || null,
      });
    }
  }

  if (settings.groupScheduleMode === 'board_rotation' && settings.numberOfBoards) {
    const createdGroups = await storage.getGroupsByTournamentId(tournamentId);
    const sortedGroups = createdGroups.sort((a, b) => a.name.localeCompare(b.name));
    await applyBoardRotationSchedule(tournamentId, sortedGroups, settings.numberOfBoards);
  }
}

export async function generateKnockoutMatches(
  tournamentId: number,
  players: Player[],
  settings: TournamentSettings
): Promise<void> {
  const seeded = settings.seeded || false;
  const totalSlots = nextPowerOfTwo(players.length);

  let bracketPlayers: (Player | null)[];
  if (seeded) {
    bracketPlayers = createSeededOrder(players);
  } else {
    bracketPlayers = [...players] as (Player | null)[];
    while (bracketPlayers.length < totalSlots) {
      bracketPlayers.push(null);
    }
  }

  const totalRounds = Math.log2(totalSlots);
  let matchOrder = 0;

  let nextRoundSlots: (Player | null)[] = [];

  for (let round = 0; round < totalRounds; round++) {
    const roundKey = getRoundKey(totalSlots, round);
    const bestOf = getBestOfForRound(roundKey, settings);

    const currentPlayers = round === 0 ? bracketPlayers : new Array(Math.pow(2, Math.log2(totalSlots) - round)).fill(null);
    const matchCount = currentPlayers.length / 2;

    for (let m = 0; m < matchCount; m++) {
      const playerA = round === 0 ? bracketPlayers[m * 2] : null;
      const playerB = round === 0 ? bracketPlayers[m * 2 + 1] : null;

      if (round === 0 && ((playerA && !playerB) || (!playerA && playerB))) {
        const winner = playerA || playerB;
        await storage.createMatch({
          tournamentId,
          stage: "KNOCKOUT",
          roundKey,
          groupId: null,
          playerAId: playerA?.id || null,
          playerBId: playerB?.id || null,
          scoreA: playerA ? 1 : 0,
          scoreB: playerB ? 1 : 0,
          bestOf: 1,
          status: "COMPLETED",
          winnerId: winner!.id,
          order: matchOrder++,
        });
        continue;
      }

      if (round === 0 && !playerA && !playerB) {
        continue;
      }

      await storage.createMatch({
        tournamentId,
        stage: "KNOCKOUT",
        roundKey,
        groupId: null,
        playerAId: playerA?.id || null,
        playerBId: playerB?.id || null,
        scoreA: 0,
        scoreB: 0,
        bestOf,
        status: "PENDING",
        winnerId: null,
        order: matchOrder++,
      });
    }
  }
}

export async function generateDoubleEliminationMatches(
  tournamentId: number,
  players: Player[],
  settings: TournamentSettings
): Promise<void> {
  const totalSlots = nextPowerOfTwo(players.length);
  const bestOf = settings.knockoutBestOf || 3;

  let bracketPlayers: (Player | null)[] = [...players];
  while (bracketPlayers.length < totalSlots) {
    bracketPlayers.push(null);
  }

  const wbRounds = Math.log2(totalSlots);
  let matchOrder = 0;

  for (let round = 0; round < wbRounds; round++) {
    const matchCount = totalSlots / Math.pow(2, round + 1);
    const roundKey = `WB_R${round + 1}`;

    for (let m = 0; m < matchCount; m++) {
      const playerA = round === 0 ? bracketPlayers[m * 2] : null;
      const playerB = round === 0 ? bracketPlayers[m * 2 + 1] : null;

      if (round === 0 && ((playerA && !playerB) || (!playerA && playerB))) {
        const winner = playerA || playerB;
        await storage.createMatch({
          tournamentId,
          stage: "WINNERS_BRACKET",
          roundKey,
          groupId: null,
          playerAId: playerA?.id || null,
          playerBId: playerB?.id || null,
          scoreA: playerA ? 1 : 0,
          scoreB: playerB ? 1 : 0,
          bestOf: 1,
          status: "COMPLETED",
          winnerId: winner!.id,
          order: matchOrder++,
        });
        continue;
      }

      if (round === 0 && !playerA && !playerB) continue;

      await storage.createMatch({
        tournamentId,
        stage: "WINNERS_BRACKET",
        roundKey,
        groupId: null,
        playerAId: playerA?.id || null,
        playerBId: playerB?.id || null,
        scoreA: 0,
        scoreB: 0,
        bestOf,
        status: "PENDING",
        winnerId: null,
        order: matchOrder++,
      });
    }
  }

  const lbRounds = Math.max(1, (wbRounds - 1) * 2);
  for (let round = 0; round < lbRounds; round++) {
    const roundKey = `LB_R${round + 1}`;
    const matchCount = Math.max(1, totalSlots / Math.pow(2, Math.floor(round / 2) + 2));

    for (let m = 0; m < matchCount; m++) {
      await storage.createMatch({
        tournamentId,
        stage: "LOSERS_BRACKET",
        roundKey,
        groupId: null,
        playerAId: null,
        playerBId: null,
        scoreA: 0,
        scoreB: 0,
        bestOf,
        status: "PENDING",
        winnerId: null,
        order: matchOrder++,
      });
    }
  }

  await storage.createMatch({
    tournamentId,
    stage: "GRAND_FINAL",
    roundKey: "GF",
    groupId: null,
    playerAId: null,
    playerBId: null,
    scoreA: 0,
    scoreB: 0,
    bestOf: getBestOfForRound("F", settings),
    status: "PENDING",
    winnerId: null,
    order: matchOrder++,
  });
}

export async function generateMultiStageMatches(
  tournamentId: number,
  players: Player[],
  settings: TournamentSettings
): Promise<void> {
  const groupCount = settings.groupCount || 2;
  const groupBestOf = settings.groupBestOf || 3;
  const promotedPerGroup = settings.promotedPerGroup || 2;

  const playersPerGroup = Math.ceil(players.length / groupCount);
  let matchOrder = 0;

  for (let g = 0; g < groupCount; g++) {
    const groupPlayers = players.slice(g * playersPerGroup, (g + 1) * playersPerGroup);
    if (groupPlayers.length === 0) continue;

    const group = await storage.createGroup({
      tournamentId,
      name: groupLabel(g),
    });

    for (const player of groupPlayers) {
      await storage.createGroupMembership({
        groupId: group.id,
        playerId: player.id,
      });
    }

    const scheduled = generateRoundRobinSchedule(groupPlayers);
    const scorerIds = assignScorersToMatches(scheduled, groupPlayers);
    for (let i = 0; i < scheduled.length; i++) {
      const sm = scheduled[i];
      const scorer = scorerIds[i] ? groupPlayers.find(p => p.id === scorerIds[i]) : null;
      await storage.createMatch({
        tournamentId,
        stage: "GROUP",
        roundKey: `R${sm.round}`,
        groupId: group.id,
        playerAId: sm.playerA.id,
        playerBId: sm.playerB.id,
        scoreA: 0,
        scoreB: 0,
        bestOf: groupBestOf,
        status: "PENDING",
        winnerId: null,
        order: matchOrder++,
        scorerId: scorerIds[i],
        scorerName: scorer?.name || null,
      });
    }
  }

  if (settings.groupScheduleMode === 'board_rotation' && settings.numberOfBoards) {
    const createdGroups = await storage.getGroupsByTournamentId(tournamentId);
    const sortedGroups = createdGroups.sort((a, b) => a.name.localeCompare(b.name));
    await applyBoardRotationSchedule(tournamentId, sortedGroups, settings.numberOfBoards);
  }

  const knockoutPlayers = groupCount * promotedPerGroup;
  const totalSlots = nextPowerOfTwo(knockoutPlayers);
  const knockoutRounds = Math.log2(totalSlots);

  for (let round = 0; round < knockoutRounds; round++) {
    const matchCount = totalSlots / Math.pow(2, round + 1);
    const roundKey = getRoundKey(totalSlots, round);
    const bestOf = getBestOfForRound(roundKey, settings);

    for (let m = 0; m < matchCount; m++) {
      await storage.createMatch({
        tournamentId,
        stage: "KNOCKOUT",
        roundKey,
        groupId: null,
        playerAId: null,
        playerBId: null,
        scoreA: 0,
        scoreB: 0,
        bestOf,
        status: "PENDING",
        winnerId: null,
        order: matchOrder++,
      });
    }
  }

  if (settings.enableThirdPlaceBracket && settings.groupScheduleMode === 'board_rotation' && settings.numberOfBoards && groupCount >= 4) {
    const tpSlots = nextPowerOfTwo(groupCount);
    const tpRounds = Math.log2(tpSlots);
    for (let round = 0; round < tpRounds; round++) {
      const matchCount = tpSlots / Math.pow(2, round + 1);
      const tpRoundKey = getTpRoundKey(tpSlots, round);
      const tp = settings.thirdPlaceBestOfByRound;
      const bestOf = tp
        ? (tpRoundKey === 'TP_QF' && tp.quarterFinal ? tp.quarterFinal
          : tpRoundKey === 'TP_SF' && tp.semiFinal ? tp.semiFinal
          : tpRoundKey === 'TP_F' && tp.final ? tp.final
          : getBestOfForRound(tpRoundKey === 'TP_F' ? 'F' : tpRoundKey === 'TP_SF' ? 'SF' : 'QF', settings))
        : getBestOfForRound(tpRoundKey === 'TP_F' ? 'F' : tpRoundKey === 'TP_SF' ? 'SF' : 'QF', settings);
      for (let m = 0; m < matchCount; m++) {
        await storage.createMatch({
          tournamentId,
          stage: "KNOCKOUT",
          roundKey: tpRoundKey,
          groupId: null,
          playerAId: null,
          playerBId: null,
          scoreA: 0,
          scoreB: 0,
          bestOf,
          status: "PENDING",
          winnerId: null,
          order: matchOrder++,
        });
      }
    }

    // Pre-assign board numbers to all knockout matches so tablets know ahead of time
    const nbBoards = settings.numberOfBoards!;
    const halfBoards = Math.floor(nbBoards / 2);
    const allNewMatches = await storage.getMatchesByTournamentId(tournamentId);
    const koMatches = allNewMatches
      .filter(m => m.stage === 'KNOCKOUT')
      .sort((a, b) => a.order - b.order);

    const mainKo = koMatches.filter(m => !(m.roundKey as string).startsWith('TP_'));
    const tpKo = koMatches.filter(m => (m.roundKey as string).startsWith('TP_'));

    const mainRounds = Array.from(new Set(mainKo.map(m => m.roundKey)));
    const firstMainRound = mainRounds[0];
    for (const rk of mainRounds) {
      const roundMatches = mainKo.filter(m => m.roundKey === rk);
      for (let i = 0; i < roundMatches.length; i++) {
        const board = rk === firstMainRound
          ? (i < nbBoards ? i + 1 : ((i - nbBoards) % halfBoards) + 1)
          : (i % halfBoards) + 1;
        await storage.updateMatch(roundMatches[i].id, { boardNumber: board } as any);
      }
    }

    const tpRoundsSorted = Array.from(new Set(tpKo.map(m => m.roundKey)));
    for (const rk of tpRoundsSorted) {
      const roundMatches = tpKo.filter(m => m.roundKey === rk);
      for (let i = 0; i < roundMatches.length; i++) {
        const board = (i % halfBoards) + halfBoards + 1;
        await storage.updateMatch(roundMatches[i].id, { boardNumber: board } as any);
      }
    }
  }
}

export async function regenerateGroupMatchesFromMemberships(
  tournamentId: number,
  settings: TournamentSettings
): Promise<void> {
  await storage.deleteGroupMatchesByTournamentId(tournamentId);

  const groups = await storage.getGroupsByTournamentId(tournamentId);
  const bestOf = settings.groupBestOf || 3;
  let matchOrder = 0;

  for (const group of groups) {
    const memberships = await storage.getGroupMembershipsByGroupId(group.id);
    const groupPlayers = memberships.map(m => m.player);
    if (groupPlayers.length < 2) continue;

    const scheduled = generateRoundRobinSchedule(groupPlayers);
    const scorerIds = assignScorersToMatches(scheduled, groupPlayers);
    for (let i = 0; i < scheduled.length; i++) {
      const sm = scheduled[i];
      const scorer = scorerIds[i] ? groupPlayers.find(p => p.id === scorerIds[i]) : null;
      await storage.createMatch({
        tournamentId,
        stage: "GROUP",
        roundKey: `R${sm.round}`,
        groupId: group.id,
        playerAId: sm.playerA.id,
        playerBId: sm.playerB.id,
        scoreA: 0,
        scoreB: 0,
        bestOf,
        status: "PENDING",
        winnerId: null,
        order: matchOrder++,
        scorerId: scorerIds[i],
        scorerName: scorer?.name || null,
      });
    }
  }

  if (settings.groupScheduleMode === 'board_rotation' && settings.numberOfBoards) {
    const sortedGroups = groups.slice().sort((a, b) => a.name.localeCompare(b.name));
    await applyBoardRotationSchedule(tournamentId, sortedGroups, settings.numberOfBoards);
  }
}

async function applyBoardRotationSchedule(
  tournamentId: number,
  sortedGroups: { id: number; name: string }[],
  numberOfBoards: number
): Promise<void> {
  if (
    numberOfBoards <= 0 ||
    sortedGroups.length % numberOfBoards !== 0 ||
    sortedGroups.length / numberOfBoards !== 2
  ) {
    return;
  }

  const allMatches = await storage.getMatchesByTournamentId(tournamentId);
  const groupMatches = allMatches
    .filter(m => m.stage === 'GROUP')
    .sort((a, b) => a.order - b.order);

  const boardSequences: (typeof groupMatches)[] = [];
  for (let b = 0; b < numberOfBoards; b++) {
    const groupA = sortedGroups[b * 2];
    const groupB = sortedGroups[b * 2 + 1];
    const matchesA = groupMatches.filter(m => m.groupId === groupA.id);
    const matchesB = groupMatches.filter(m => m.groupId === groupB.id);
    const maxLen = Math.max(matchesA.length, matchesB.length);
    const interleaved: typeof groupMatches = [];
    for (let i = 0; i < maxLen; i++) {
      if (i < matchesA.length) interleaved.push(matchesA[i]);
      if (i < matchesB.length) interleaved.push(matchesB[i]);
    }
    boardSequences.push(interleaved);
  }

  const maxSlots = Math.max(...boardSequences.map(s => s.length));
  let globalOrder = 0;
  const updates: Array<{ id: number; boardNumber: number; order: number }> = [];

  for (let slot = 0; slot < maxSlots; slot++) {
    for (let b = 0; b < numberOfBoards; b++) {
      const match = boardSequences[b][slot];
      if (match) {
        updates.push({ id: match.id, boardNumber: b + 1, order: globalOrder++ });
      }
    }
  }

  for (const u of updates) {
    await storage.updateMatch(u.id, { boardNumber: u.boardNumber, order: u.order });
  }
}

export async function generateMatches(
  tournamentId: number,
  players: Player[],
  type: string,
  settings: TournamentSettings
): Promise<void> {
  switch (type) {
    case "ROUND_ROBIN":
      await generateRoundRobinMatches(tournamentId, players, settings);
      break;
    case "KNOCKOUT":
      await generateKnockoutMatches(tournamentId, players, settings);
      break;
    case "DOUBLE_ELIMINATION":
      await generateDoubleEliminationMatches(tournamentId, players, settings);
      break;
    case "MULTI_STAGE":
      await generateMultiStageMatches(tournamentId, players, settings);
      break;
  }
}
