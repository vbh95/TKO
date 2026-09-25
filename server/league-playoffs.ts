import type { League, LeaguePlayerMembership } from "@shared/schema";
import { buildLeaguePlayerProfile } from "./league-player-profile";
import type { LeagueProfileSource } from "./storage";
import { calculateLeagueStandings, normalizeLeaguePlayerIdentity } from "./league-standings";

export type LeaguePlayoffRow = {
  identity: string;
  name: string;
  position: number;
  points: number;
  profilePlayerId: number | null;
  qualification: "automatic" | "not-automatic" | "unconfigured";
  tournamentsAttended: number | null;
  totalTournaments: number;
  attendancePercentage: number | null;
  membership: "member" | "non-member" | "unknown";
  tournamentWins: number | null;
  runnerUp: number | null;
  threeDartAverage: number | null;
  bestTournamentAverage: number | null;
  first9Average: number | null;
  highestCheckout: number | null;
  bestLeg: number | null;
  oneEighties: number | null;
  matchWinPercentage: number | null;
  legWinPercentage: number | null;
};

export type LeaguePlayoffsData = {
  league: Pick<League, "id" | "userId" | "name" | "promotionCount">;
  totalTournaments: number;
  players: LeaguePlayoffRow[];
  selectedIdentities: string[];
};

export function getLeaguePlayoffStandings(source: LeagueProfileSource) {
  const tournaments = source.tournaments.map(tournament => ({
    tournament,
    players: source.players.filter(player => player.tournamentId === tournament.id).sort((a, b) => a.id - b.id),
    matches: source.matches.filter(match => match.tournamentId === tournament.id),
  }));
  return calculateLeagueStandings(tournaments, source.manualResults);
}

export function normalizeCurrentPlayoffIdentity(
  requestedIdentity: unknown,
  source: LeagueProfileSource,
): string | null {
  if (typeof requestedIdentity !== "string" || !requestedIdentity.trim() || requestedIdentity.length > 255) {
    return null;
  }
  const identity = normalizeLeaguePlayerIdentity(requestedIdentity);
  return getLeaguePlayoffStandings(source).some(row =>
    normalizeLeaguePlayerIdentity(row.name) === identity,
  ) ? identity : null;
}

export function buildLeaguePlayoffsData(
  league: League,
  source: LeagueProfileSource,
  memberships: LeaguePlayerMembership[],
  storedSelectedIdentities: string[],
): LeaguePlayoffsData {
  const standings = getLeaguePlayoffStandings(source);
  const membershipsByIdentity = new Map(
    memberships.map(membership => [membership.normalizedPlayerIdentity, membership]),
  );
  const players = standings.map((standing, index): LeaguePlayoffRow => {
    const identity = normalizeLeaguePlayerIdentity(standing.name);
    const profilePlayer = standing.profilePlayerId === null
      ? undefined
      : source.players.find(player => player.id === standing.profilePlayerId);
    const profile = profilePlayer ? buildLeaguePlayerProfile(league, profilePlayer, source) : null;
    const membership = membershipsByIdentity.get(identity);
    const promotionCount = league.promotionCount ?? 0;

    return {
      identity,
      name: standing.name,
      position: index + 1,
      points: standing.points,
      profilePlayerId: profilePlayer?.id ?? null,
      qualification: promotionCount > 0
        ? index + 1 <= promotionCount ? "automatic" : "not-automatic"
        : "unconfigured",
      tournamentsAttended: profile?.summary.tournamentsAttended ?? null,
      totalTournaments: source.tournaments.length,
      attendancePercentage: profile?.summary.attendancePercentage ?? null,
      membership: membership === undefined ? "unknown" :
        membership.isClubMember ? "member" : "non-member",
      tournamentWins: profile?.summary.tournamentWins ?? null,
      runnerUp: profile?.stats.finishes.runnerUp ?? null,
      threeDartAverage: profile?.stats.scoring.threeDartAverage ?? null,
      bestTournamentAverage: profile?.stats.records.bestTournamentAverage?.value ?? null,
      first9Average: profile?.stats.scoring.first9Average ?? null,
      highestCheckout: profile?.stats.finishing.highestCheckout ?? null,
      bestLeg: profile?.stats.records.bestLeg?.value ?? null,
      oneEighties: profile?.stats.scoring.oneEighties ?? null,
      matchWinPercentage: profile?.stats.matches.winPercentage ?? null,
      legWinPercentage: profile?.stats.legs.winPercentage ?? null,
    };
  });
  const currentIdentities = new Set(players.map(player => player.identity));
  const selectedSet = new Set(storedSelectedIdentities.map(normalizeLeaguePlayerIdentity));
  const selectedIdentities = players
    .filter(player => currentIdentities.has(player.identity) && selectedSet.has(player.identity))
    .map(player => player.identity);

  return {
    league: {
      id: league.id,
      userId: league.userId,
      name: league.name,
      promotionCount: league.promotionCount,
    },
    totalTournaments: source.tournaments.length,
    players,
    selectedIdentities,
  };
}