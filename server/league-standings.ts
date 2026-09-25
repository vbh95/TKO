import type { LeagueManualResult, Match, Player, Tournament } from "@shared/schema";

export function normalizeLeaguePlayerIdentity(name: string): string {
  return name.replace(/\s+/g, " ").toLowerCase().trim();
}

export const LEAGUE_STAGE_POINTS: Record<string, number> = {
  GROUP: 5,
  QF: 10,
  SF: 20,
  RUNNER_UP: 30,
  WINNER: 40,
};

export type LeagueTournamentResults = {
  tournament: Tournament;
  players: Player[];
  matches: Match[];
};

export type LeagueStanding = {
  name: string;
  points: number;
  legsWon: number;
  legsLost: number;
  tournaments: number;
  wins: number;
  profilePlayerId: number | null;
};

// This is the existing league points classification, shared with the private report.
// In particular R16 is still worth GROUP points; profile display must not alter it.
export function getLeaguePointStage(playerId: number, completedMatches: Match[]): string {
  const eliminationMatches = completedMatches.filter(m =>
    m.stage === "KNOCKOUT" || m.stage === "WINNERS_BRACKET" ||
    m.stage === "LOSERS_BRACKET" || m.stage === "GRAND_FINAL"
  );
  const finalMatch = eliminationMatches.find(m => m.roundKey === "F" || m.stage === "GRAND_FINAL");
  const sfMatches = eliminationMatches.filter(m => m.roundKey === "SF");
  const qfMatches = eliminationMatches.filter(m => m.roundKey === "QF");

  if (finalMatch && finalMatch.winnerId === playerId) return "WINNER";
  if (finalMatch && (finalMatch.playerAId === playerId || finalMatch.playerBId === playerId)) return "RUNNER_UP";
  if (sfMatches.some(m => m.playerAId === playerId || m.playerBId === playerId)) return "SF";
  if (qfMatches.some(m => m.playerAId === playerId || m.playerBId === playerId)) return "QF";
  return "GROUP";
}

// Keep the same iteration, aggregation and tie-break order as the original owner standings route.
export function calculateLeagueStandings(
  tournamentResults: LeagueTournamentResults[],
  manualResults: LeagueManualResult[],
): LeagueStanding[] {
  const playerAgg: Record<string, LeagueStanding> = {};

  for (const { matches: allMatches, players: playersList } of tournamentResults) {
    const completedMatches = allMatches.filter(m => m.status === "COMPLETED");

    for (const player of playersList) {
      const key = normalizeLeaguePlayerIdentity(player.name);
      if (!playerAgg[key]) {
        playerAgg[key] = {
          name: player.name, points: 0, legsWon: 0, legsLost: 0,
          tournaments: 0, wins: 0, profilePlayerId: player.id,
        };
      }

      const playerMatches = completedMatches.filter(m => m.playerAId === player.id || m.playerBId === player.id);
      if (playerMatches.length === 0) continue;

      playerMatches.forEach(m => {
        const isA = m.playerAId === player.id;
        playerAgg[key].legsWon += isA ? (m.scoreA || 0) : (m.scoreB || 0);
        playerAgg[key].legsLost += isA ? (m.scoreB || 0) : (m.scoreA || 0);
      });

      const stage = getLeaguePointStage(player.id, completedMatches);
      playerAgg[key].points += LEAGUE_STAGE_POINTS[stage] || 0;
      playerAgg[key].tournaments += 1;
      if (stage === "WINNER") playerAgg[key].wins += 1;
    }
  }

  const manualTournamentsByPlayer: Record<string, Set<string>> = {};
  for (const mr of manualResults) {
    const key = normalizeLeaguePlayerIdentity(mr.playerName);
    if (!playerAgg[key]) {
      playerAgg[key] = {
        name: mr.playerName, points: 0, legsWon: 0, legsLost: 0,
        tournaments: 0, wins: 0, profilePlayerId: null,
      };
    }
    playerAgg[key].points += mr.points;
    playerAgg[key].legsWon += mr.legsWon;
    playerAgg[key].legsLost += mr.legsLost;
    if (!manualTournamentsByPlayer[key]) manualTournamentsByPlayer[key] = new Set();
    manualTournamentsByPlayer[key].add(mr.tournamentLabel.toLowerCase().trim());
  }
  for (const [key, labels] of Object.entries(manualTournamentsByPlayer)) {
    if (playerAgg[key]) playerAgg[key].tournaments += labels.size;
  }

  return Object.values(playerAgg).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.legsWon !== a.legsWon) return b.legsWon - a.legsWon;
    const diffA = a.legsWon - a.legsLost;
    const diffB = b.legsWon - b.legsLost;
    if (diffB !== diffA) return diffB - diffA;
    return b.tournaments - a.tournaments;
  });
}