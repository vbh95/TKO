import type { League, LeaguePlayerMembership, Match, MatchNote, Player, Tournament } from "@shared/schema";
import type { LeagueProfileSource } from "./storage";
import {
  calculateLeagueStandings, getLeaguePointStage, LEAGUE_STAGE_POINTS,
  normalizeLeaguePlayerIdentity, type LeagueTournamentResults,
} from "./league-standings";

type RecordValue<T> = {
  value: T;
  tournament: string;
  round?: string;
  opponent?: string;
};

type PlayedMatch = {
  match: Match;
  playerId: number;
  note: MatchNote | undefined;
  tournament: Tournament;
  opponent: string;
};

type ScoredLeg = {
  winner: "A" | "B";
  checkoutDartsUsed: number;
  visits: Array<{ player: "A" | "B"; score: number }>;
};

type SideStatField = "tons" | "ton40s" | "ton80s" | "checkoutAttempts" |
  "checkoutSuccess" | "highestFinish" | "highestVisit";

const nonnegative = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

function completeSum(values: Array<number | null | undefined>): number | null {
  return values.length > 0 && values.every(nonnegative)
    ? values.reduce((sum, value) => sum + (value ?? 0), 0) : null;
}

function average(matches: PlayedMatch[], field: "overall" | "first9"): number | null {
  if (field === "first9") return first9Average(matches);
  if (!matches.length) return null;
  let numerator = 0;
  let denominator = 0;
  for (const { match, playerId, note } of matches) {
    const isA = match.playerAId === playerId;
    const points = isA ? note?.totalScoredA : note?.totalScoredB;
    const count = isA ? note?.totalVisitsA : note?.totalVisitsB;
    if (!nonnegative(points) || !nonnegative(count) || count === 0) return null;
    numerator += points;
    denominator += count;
  }
  return denominator ? Math.round((numerator / denominator) * 100) / 100 : null;
}

function parsedLegHistory(row: PlayedMatch): ScoredLeg[] | null {
  const { match, note } = row;
  if (!nonnegative(match.scoreA) || !nonnegative(match.scoreB) || !Array.isArray(note?.legHistory) ||
    note.legHistory.length !== match.scoreA + match.scoreB) return null;
  const legs: ScoredLeg[] = [];
  for (const leg of note.legHistory) {
    if (!leg || typeof leg !== "object" || (leg.winner !== "A" && leg.winner !== "B") ||
      !Number.isInteger(leg.checkoutDartsUsed) || leg.checkoutDartsUsed < 1 || leg.checkoutDartsUsed > 3 ||
      !Array.isArray(leg.visits) || !leg.visits.length ||
      !leg.visits.every((v: any) =>
        v && (v.player === "A" || v.player === "B") && nonnegative(v.score) && v.score <= 180) ||
      leg.visits[leg.visits.length - 1].player !== leg.winner) return null;
    legs.push(leg as ScoredLeg);
  }
  if (legs.filter(leg => leg.winner === "A").length !== match.scoreA ||
    legs.filter(leg => leg.winner === "B").length !== match.scoreB) return null;
  return legs;
}

function first9Average(matches: PlayedMatch[]): number | null {
  if (!matches.length) return null;
  let points = 0;
  let darts = 0;
  for (const row of matches) {
    const legs = parsedLegHistory(row);
    if (!legs) return null;
    const side = row.match.playerAId === row.playerId ? "A" : "B";
    for (const leg of legs) {
      const ownVisits = leg.visits.filter(v => v.player === side);
      const firstVisits = ownVisits.slice(0, 3);
      points += firstVisits.reduce((sum, visit) => sum + visit.score, 0);
      // Persisted first9Darts counts every checkout visit as 3 darts. The leg
      // history records the actual checkout darts, so short legs can be exact.
      darts += firstVisits.length * 3 -
        (leg.winner === side && ownVisits.length <= 3 ? 3 - leg.checkoutDartsUsed : 0);
    }
  }
  return darts ? Math.round(points / darts * 300) / 100 : null;
}

function matchValue(row: PlayedMatch, field: SideStatField): number | null {
  const isA = row.match.playerAId === row.playerId;
  const side = `${field}${isA ? "A" : "B"}` as keyof MatchNote;
  const value = row.note?.[side];
  return typeof value === "number" && nonnegative(value) ? value : null;
}

function completeMatchValues(rows: PlayedMatch[], field: SideStatField): number | null {
  return completeSum(rows.map(row => matchValue(row, field)));
}

function bestLegDarts(row: PlayedMatch): number | null {
  const legs = parsedLegHistory(row);
  if (!legs) return null;
  const side = row.match.playerAId === row.playerId ? "A" : "B";
  const winningLegs = legs.filter(leg => leg.winner === side);
  if (!winningLegs.length) return null;
  const darts = winningLegs.map(leg => {
    const ownVisits = leg.visits.filter(v => v.player === side).length;
    return ownVisits ? (ownVisits - 1) * 3 + leg.checkoutDartsUsed : null;
  });
  return darts.every(nonnegative) ? Math.min(...darts as number[]) : null;
}

function finishForPlayer(playerId: number, completed: Match[]): string | null {
  const played = completed.filter(m => m.playerAId === playerId || m.playerBId === playerId);
  if (!played.length) return null;
  const pointStage = getLeaguePointStage(playerId, completed);
  if (pointStage === "WINNER") return "Winner";
  if (pointStage === "RUNNER_UP") return "Runner-up";
  if (pointStage === "SF") return "Semi-final";
  if (pointStage === "QF") return "Quarter-final";
  if (played.some(m => m.stage === "KNOCKOUT" && m.roundKey === "R16")) return "R16";
  if (played.some(m => m.stage === "KNOCKOUT" && m.roundKey === "R32")) return "R32";
  if (played.every(m => m.stage === "GROUP")) return "Group stage";
  return null; // Other elimination formats do not have a trustworthy finish label.
}

function tournamentTime(t: Tournament): number {
  const date = t.eventDate ? Date.parse(t.eventDate) : NaN;
  return Number.isFinite(date) ? date : (t.createdAt?.getTime() ?? 0);
}

export function buildLeaguePlayerProfile(
  league: League,
  selectedPlayer: Player,
  source: LeagueProfileSource,
  membership?: LeaguePlayerMembership,
) {
  const identity = normalizeLeaguePlayerIdentity(selectedPlayer.name);
  const playerMap = new Map(source.players.map(player => [player.id, player]));
  const noteMap = new Map(source.notes.map(note => [note.matchId, note]));
  const tournamentMap = new Map(source.tournaments.map(t => [t.id, t]));
  const playerIds = new Set(source.players.filter(p => normalizeLeaguePlayerIdentity(p.name) === identity).map(p => p.id));
  const grouped: LeagueTournamentResults[] = source.tournaments.map(t => ({
    tournament: t,
    players: source.players.filter(p => p.tournamentId === t.id),
    matches: source.matches.filter(m => m.tournamentId === t.id),
  }));
  const standings = calculateLeagueStandings(grouped, source.manualResults);
  const index = standings.findIndex(s => normalizeLeaguePlayerIdentity(s.name) === identity);
  const standing = standings[index];

  const playedMatches: PlayedMatch[] = source.matches
    .filter(m => m.status === "COMPLETED" && (playerIds.has(m.playerAId ?? -1) || playerIds.has(m.playerBId ?? -1)))
    .map(match => {
      const playerId = playerIds.has(match.playerAId ?? -1) ? match.playerAId! : match.playerBId!;
      const opponentId = playerId === match.playerAId ? match.playerBId : match.playerAId;
      return {
        match, playerId, note: noteMap.get(match.id),
        tournament: tournamentMap.get(match.tournamentId)!,
        opponent: playerMap.get(opponentId ?? -1)?.name ?? "Unknown",
      };
    });
  const validWinners = playedMatches.every(row => row.match.winnerId === row.playerId ||
    (row.match.winnerId !== null && row.match.winnerId === (row.playerId === row.match.playerAId ? row.match.playerBId : row.match.playerAId)));
  const matchWins = playedMatches.filter(row => row.match.winnerId === row.playerId).length;
  const matchLosses = validWinners ? playedMatches.length - matchWins : null;
  const scoresComplete = playedMatches.length > 0 &&
    playedMatches.every(row => nonnegative(row.match.scoreA) && nonnegative(row.match.scoreB));
  const legsWon = scoresComplete ? playedMatches.reduce((sum, row) =>
    sum + (row.playerId === row.match.playerAId ? row.match.scoreA! : row.match.scoreB!), 0) : null;
  const legsLost = scoresComplete ? playedMatches.reduce((sum, row) =>
    sum + (row.playerId === row.match.playerAId ? row.match.scoreB! : row.match.scoreA!), 0) : null;

  const visits100 = completeMatchValues(playedMatches, "tons");
  const visits140 = completeMatchValues(playedMatches, "ton40s");
  const visits180 = completeMatchValues(playedMatches, "ton80s");
  const checkoutAttempts = completeMatchValues(playedMatches, "checkoutAttempts");
  const checkoutSuccess = completeMatchValues(playedMatches, "checkoutSuccess");
  const finishes = playedMatches.map(row => matchValue(row, "highestFinish"));
  const visits = playedMatches.map(row => matchValue(row, "highestVisit"));
  const highestCheckout = finishes.length && finishes.every(nonnegative) ? Math.max(...finishes as number[]) || null : null;
  const highestVisit = visits.length && visits.every(nonnegative) ? Math.max(...visits as number[]) || null : null;

  const allLegs = playedMatches.map(row => bestLegDarts(row)).filter(nonnegative);
  const reliableLegHistory = playedMatches.length > 0 && playedMatches.every(row => parsedLegHistory(row) !== null);
  const bestLeg = reliableLegHistory && allLegs.length ? Math.min(...allLegs) : null;
  const matchAverages = playedMatches.map(row => average([row], "overall"));
  const bestMatchAverage = matchAverages.length && matchAverages.every(nonnegative)
    ? Math.max(...matchAverages as number[]) : null;

  // Manual results have a text label, not a tournament ID. Attribute them only
  // when that label names exactly one tournament in this league.
  const labelCounts = new Map<string, number>();
  for (const t of source.tournaments) {
    const label = t.name.toLowerCase().trim();
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  }
  const playerManualResults = source.manualResults.filter(mr =>
    normalizeLeaguePlayerIdentity(mr.playerName) === identity);
  const unattributedManual = playerManualResults.filter(mr =>
    labelCounts.get(mr.tournamentLabel.toLowerCase().trim()) !== 1);

  const history = [...source.tournaments].sort((a, b) => tournamentTime(a) - tournamentTime(b) || a.id - b.id).map(t => {
    const rows = playedMatches.filter(row => row.tournament.id === t.id);
    const tournamentPlayers = grouped.find(group => group.tournament.id === t.id)?.players
      .filter(p => playerIds.has(p.id)) ?? [];
    const tournamentCompleted = grouped.find(group => group.tournament.id === t.id)?.matches
      .filter(m => m.status === "COMPLETED") ?? [];
    const label = t.name.toLowerCase().trim();
    const manual = labelCounts.get(label) === 1
      ? playerManualResults.filter(mr => mr.tournamentLabel.toLowerCase().trim() === label)
      : [];
    const attended = rows.length > 0 || manual.length > 0;
    const complete = t.status === "COMPLETED";
    const stages = tournamentPlayers.map(p => finishForPlayer(p.id, tournamentCompleted)).filter((s): s is string => !!s);
    const finishOrder = ["Winner", "Runner-up", "Semi-final", "Quarter-final", "R16", "R32", "Group stage"];
    const finish = complete && stages.length ? stages.sort((a, b) => finishOrder.indexOf(a) - finishOrder.indexOf(b))[0] : null;
    const officialPoints = rows.length ? tournamentPlayers.reduce((sum, p) => {
      const matchesForPlayer = tournamentCompleted.filter(m => m.playerAId === p.id || m.playerBId === p.id);
      return sum + (matchesForPlayer.length ? LEAGUE_STAGE_POINTS[getLeaguePointStage(p.id, tournamentCompleted)] ?? 0 : 0);
    }, 0) : 0;
    const points = attended ? officialPoints + manual.reduce((sum, mr) => sum + mr.points, 0) : null;
    const tournamentFinishes = rows.map(row => matchValue(row, "highestFinish"));
    const tournament180s = completeMatchValues(rows, "ton80s");
    const tournamentBestLeg = rows.map(bestLegDarts).filter(nonnegative);
    const tournamentLegsReliable = rows.every(row => parsedLegHistory(row) !== null);
    return {
      tournamentId: t.id, tournament: t.name,
      date: t.eventDate ?? (t.createdAt?.toISOString() ?? null),
      status: t.status,
      attended: attended ? true : (complete ? false : null),
      finish, points,
      threeDartAverage: average(rows, "overall"),
      first9Average: average(rows, "first9"),
      bestLeg: tournamentLegsReliable && tournamentBestLeg.length ? Math.min(...tournamentBestLeg) : null,
      highestCheckout: tournamentFinishes.length && tournamentFinishes.every(nonnegative)
        ? Math.max(...tournamentFinishes as number[]) || null : null,
      oneEighties: tournament180s,
    };
  });

  const completedTournaments = source.tournaments.filter(t => t.status === "COMPLETED").length;
  const attendedCompleted = history.filter(h => h.status === "COMPLETED" && h.attended).length;
  const finishCounts = {
    runnerUp: history.filter(h => h.finish === "Runner-up").length,
    semiFinal: history.filter(h => h.finish === "Semi-final").length,
    quarterFinal: history.filter(h => h.finish === "Quarter-final").length,
    roundOf16: history.filter(h => h.finish === "R16").length,
    groupStage: history.filter(h => h.finish === "Group stage").length,
  };
  const tournamentAverages = history.filter(h => h.attended).map(h => h.threeDartAverage);
  const bestTournamentAverage = tournamentAverages.length && tournamentAverages.every(nonnegative)
    ? Math.max(...tournamentAverages as number[]) : null;
  const unfinishedFinish = history.some(h => h.status === "COMPLETED" && h.attended && h.finish === null);
  const bestFinish = unfinishedFinish ? undefined : history.find(h => h.finish === "Winner") ??
    history.find(h => h.finish === "Runner-up") ??
    history.find(h => h.finish === "Semi-final") ??
    history.find(h => h.finish === "Quarter-final") ??
    history.find(h => h.finish === "R16") ??
    history.find(h => h.finish === "R32") ??
    history.find(h => h.finish === "Group stage");
  const bestLegRow = bestLeg === null ? null : playedMatches.find(row => bestLegDarts(row) === bestLeg);
  const bestMatchRow = bestMatchAverage === null ? null : playedMatches.find(row => average([row], "overall") === bestMatchAverage);
  const highestCheckoutRow = highestCheckout === null ? null : playedMatches.find(row => matchValue(row, "highestFinish") === highestCheckout);
  const highestVisitRow = highestVisit === null ? null : playedMatches.find(row => matchValue(row, "highestVisit") === highestVisit);
  const record = (row: PlayedMatch | undefined | null, value: number | null): RecordValue<number> | null =>
    row && value !== null ? { value, tournament: row.tournament.name, round: row.match.roundKey, opponent: row.opponent } : null;
  const most180sTournament = history.some(h => h.attended && h.oneEighties === null)
    ? undefined
    : history.filter(h => h.oneEighties !== null && h.attended)
      .sort((a, b) => (b.oneEighties ?? 0) - (a.oneEighties ?? 0))[0];
  const bestTournament = bestTournamentAverage === null ? null :
    history.find(h => h.threeDartAverage === bestTournamentAverage);

  // A match has no completion timestamp; order within a tournament and across dates
  // cannot reliably reconstruct a season-long winning streak. Historical positions
  // also cannot be reconstructed without assigning undated manual results to events.
  return {
    league: { id: league.id, userId: league.userId, name: league.name, startDate: league.startDate, endDate: league.endDate },
    player: { id: selectedPlayer.id, name: standing?.name ?? selectedPlayer.name },
    membership: {
      isClubMember: membership?.isClubMember ?? false,
      membershipConfirmedAt: membership?.membershipConfirmedAt ?? null,
    },
    summary: {
      position: index >= 0 ? index + 1 : null,
      points: standing?.points ?? 0,
      unattributedManualResults: unattributedManual.length,
      unattributedManualPoints: unattributedManual.reduce((sum, mr) => sum + mr.points, 0),
      tournamentsEntered: source.tournaments.filter(t => source.players.some(p =>
        p.tournamentId === t.id && playerIds.has(p.id))).length,
      tournamentsAttended: attendedCompleted,
      totalTournaments: source.tournaments.length,
      completedTournaments,
      attendancePercentage: completedTournaments ? Math.round(attendedCompleted / completedTournaments * 100) : null,
      tournamentWins: standing?.wins ?? 0,
    },
    stats: {
      finishes: finishCounts,
      matches: {
        played: playedMatches.length, won: matchWins, lost: matchLosses,
        winPercentage: validWinners && playedMatches.length ? Math.round(matchWins / playedMatches.length * 100) : null,
      },
      legs: {
        won: legsWon, lost: legsLost,
        difference: legsWon !== null && legsLost !== null ? legsWon - legsLost : null,
        winPercentage: legsWon !== null && legsLost !== null && legsWon + legsLost > 0
          ? Math.round(legsWon / (legsWon + legsLost) * 100) : null,
      },
      scoring: {
        threeDartAverage: average(playedMatches, "overall"),
        first9Average: average(playedMatches, "first9"),
        visits100Plus: visits100 !== null && visits140 !== null && visits180 !== null
          ? visits100 + visits140 + visits180 : null,
        visits140Plus: visits140 !== null && visits180 !== null ? visits140 + visits180 : null,
        oneEighties: visits180,
      },
      finishing: {
        checkoutPercentage: checkoutAttempts && checkoutSuccess !== null
          ? Math.round(checkoutSuccess / checkoutAttempts * 10000) / 100 : null,
        highestCheckout,
      },
      records: {
        bestLeg: record(bestLegRow, bestLeg),
        highestVisit: record(highestVisitRow, highestVisit),
        bestMatchAverage: record(bestMatchRow, bestMatchAverage),
        bestTournamentAverage: bestTournament
          ? { value: bestTournamentAverage, tournament: bestTournament.tournament } : null,
        bestFinish: bestFinish?.finish ? { value: bestFinish.finish, tournament: bestFinish.tournament } : null,
        most180sTournament: most180sTournament
          ? { value: most180sTournament.oneEighties!, tournament: most180sTournament.tournament } : null,
        highestCheckout: record(highestCheckoutRow, highestCheckout),
        longestMatchWinningStreak: null,
      },
    },
    history,
  };
}