import assert from "node:assert/strict";
import { test } from "node:test";
import type { League, LeagueManualResult, Match, MatchNote, Player, Tournament } from "../shared/schema";
import { buildLeaguePlayerProfile } from "../server/league-player-profile";
import { calculateLeagueStandings, getLeaguePointStage, normalizeLeaguePlayerIdentity } from "../server/league-standings";
import type { LeagueProfileSource } from "../server/storage";

const league = {
  id: 1, userId: 7, name: "League", startDate: null, endDate: null,
} as League;

function tournament(id: number, name: string, status = "COMPLETED"): Tournament {
  return {
    id, leagueId: 1, name, status,
    eventDate: `2026-09-${String(id).padStart(2, "0")}`,
    createdAt: new Date(`2026-09-${String(id).padStart(2, "0")}`),
  } as Tournament;
}

function player(id: number, tournamentId: number, name: string): Player {
  return { id, tournamentId, name, seed: null };
}

function match(id: number, tournamentId: number, a: number, b: number, winner: number, roundKey = "F"): Match {
  return {
    id, tournamentId, playerAId: a, playerBId: b, winnerId: winner,
    status: "COMPLETED", stage: "KNOCKOUT", roundKey,
    scoreA: 3, scoreB: 2, groupId: null, bestOf: 5, order: 0,
  } as Match;
}

function source(tournaments: Tournament[], players: Player[], matches: Match[], notes: MatchNote[] = [],
  manualResults: LeagueManualResult[] = []): LeagueProfileSource {
  return { tournaments, players, matches, notes, manualResults };
}

test("the standings helper preserves existing stage points, manual results and identity rules", () => {
  const late = tournament(2, "Second");
  const early = tournament(1, "First");
  const p = [player(11, 2, " Alice  Smith "), player(12, 2, "Bob"),
    player(21, 1, "Alice Smith"), player(22, 1, "Bob")];
  const results = [
    { tournament: late, players: p.slice(0, 2), matches: [match(101, 2, 11, 12, 11)] },
    { tournament: early, players: p.slice(2), matches: [match(102, 1, 21, 22, 22)] },
  ];
  const manual = [{ playerName: "ALICE SMITH", tournamentLabel: "Extra", points: 5,
    legsWon: 1, legsLost: 2 }] as LeagueManualResult[];
  const standings = calculateLeagueStandings(results, manual);
  assert.equal(normalizeLeaguePlayerIdentity(" Alice  Smith "), "alice smith");
  assert.deepEqual(standings.map(s => [s.name, s.points, s.tournaments, s.profilePlayerId]), [
    [" Alice  Smith ", 75, 3, 11], ["Bob", 70, 2, 12],
  ]);
  assert.equal(standings[0].legsWon, 7);
  assert.equal(standings[0].legsLost, 6);
  assert.equal(getLeaguePointStage(11, [match(103, 2, 11, 12, 12, "R16")]), "GROUP");
});

test("a one-tournament profile uses weighted persisted match statistics and precise leg history", () => {
  const t = tournament(1, "TKO #1");
  const p = [player(11, 1, "Alice"), player(12, 1, "Bob")];
  const m = match(101, 1, 11, 12, 11);
  const leg = (winner: "A" | "B", checkoutDartsUsed: number) => ({
    winner, checkoutDartsUsed, startingThrower: "A",
    visits: [100, 100, 100, 100, 101].flatMap(score => [
      { player: winner === "A" ? "B" : "A", score: 40 },
      { player: winner, score },
    ]),
  });
  const note = {
    matchId: 101, totalScoredA: 1500, totalVisitsA: 30,
    first9PointsA: 480, first9DartsA: 27,
    tonsA: 2, ton40sA: 1, ton80sA: 1,
    checkoutAttemptsA: 5, checkoutSuccessA: 3,
    highestFinishA: 96, highestVisitA: 180,
    legHistory: [leg("A", 2), leg("B", 3), leg("A", 3), leg("B", 3), leg("A", 3)],
  } as MatchNote;
  const profile = buildLeaguePlayerProfile(league, p[0], source([t], p, [m], [note]));
  assert.equal(profile.summary.position, 1);
  assert.equal(profile.summary.points, 40);
  assert.equal(profile.summary.attendancePercentage, 100);
  assert.equal(profile.stats.matches.won, 1);
  assert.equal(profile.stats.legs.won, 3);
  assert.equal(profile.stats.scoring.threeDartAverage, 50);
  assert.equal(profile.stats.scoring.first9Average, 76);
  assert.equal(profile.stats.scoring.visits100Plus, 4);
  assert.equal(profile.stats.scoring.visits140Plus, 2);
  assert.equal(profile.stats.scoring.oneEighties, 1);
  assert.equal(profile.stats.finishing.checkoutPercentage, 60);
  assert.equal(profile.history[0].bestLeg, 14);
  assert.equal(profile.stats.records.bestLeg?.value, 14);
  assert.equal(profile.stats.records.longestMatchWinningStreak, null);
});

test("empty and incomplete results remain null rather than invented zeros", () => {
  const complete = tournament(1, "TKO #1");
  const upcoming = tournament(2, "TKO #2", "NOT_STARTED");
  const p = [player(11, 1, "Alice"), player(12, 1, "Bob")];
  const empty = buildLeaguePlayerProfile(league, p[0], source([upcoming, complete], p, []));
  assert.equal(empty.summary.tournamentsAttended, 0);
  assert.equal(empty.summary.attendancePercentage, 0);
  assert.equal(empty.stats.scoring.threeDartAverage, null);
  assert.equal(empty.stats.scoring.oneEighties, null);
  assert.equal(empty.history[0].attended, false);
  assert.equal(empty.history[1].attended, null);

  const incomplete = buildLeaguePlayerProfile(league, p[0], source([complete], p, [match(101, 1, 11, 12, 11)]));
  assert.equal(incomplete.summary.tournamentsAttended, 1);
  assert.equal(incomplete.stats.scoring.first9Average, null);
  assert.equal(incomplete.stats.finishing.highestCheckout, null);
  assert.equal(incomplete.stats.records.bestLeg, null);
  assert.equal(incomplete.history[0].oneEighties, null);
});

test("first-nine uses actual checkout darts rather than the persisted three-per-visit denominator", () => {
  const p = [player(11, 1, "Alice"), player(12, 1, "Bob")];
  const m = { ...match(101, 1, 11, 12, 11), scoreA: 1, scoreB: 0 } as Match;
  const note = {
    matchId: 101, first9PointsA: 201, first9DartsA: 6,
    legHistory: [{
      winner: "A", checkoutDartsUsed: 2, startingThrower: "A",
      visits: [{ player: "A", score: 100 }, { player: "B", score: 60 }, { player: "A", score: 101 }],
    }],
  } as MatchNote;
  const profile = buildLeaguePlayerProfile(league, p[0], source([tournament(1, "TKO")], p, [m], [note]));
  assert.equal(profile.stats.scoring.first9Average, 120.6);
  assert.equal(profile.stats.records.bestLeg?.value, 5);
  assert.equal(profile.stats.scoring.threeDartAverage, null);
});

test("ambiguous or external manual labels remain in league points but never duplicate tournament history", () => {
  const p = [player(11, 1, "Alice"), player(12, 1, "Bob")];
  const manual = [
    { playerName: "ALICE", tournamentLabel: "TKO", points: 7, legsWon: 0, legsLost: 0 },
    { playerName: "Alice", tournamentLabel: "Outside", points: 5, legsWon: 0, legsLost: 0 },
  ] as LeagueManualResult[];
  const profile = buildLeaguePlayerProfile(league, p[0], source(
    [tournament(1, "TKO"), tournament(2, "TKO")], p,
    [match(101, 1, 11, 12, 11)], [], manual,
  ));
  assert.equal(profile.summary.points, 52);
  assert.equal(profile.summary.unattributedManualResults, 2);
  assert.equal(profile.summary.unattributedManualPoints, 12);
  assert.deepEqual(profile.history.map(h => h.points), [40, null]);
  assert.deepEqual(profile.history.map(h => h.attended), [true, false]);
});

test("incorrect winning-leg counts make both season and tournament best-leg statistics unavailable", () => {
  const p = [player(11, 1, "Alice"), player(12, 1, "Bob")];
  const m = { ...match(101, 1, 11, 12, 11), scoreA: 2, scoreB: 0 } as Match;
  const leg = { winner: "A", checkoutDartsUsed: 2, visits: [{ player: "A", score: 101 }] };
  const badNote = { matchId: 101, legHistory: [leg, { ...leg, winner: "B" }] } as MatchNote;
  const profile = buildLeaguePlayerProfile(league, p[0], source([tournament(1, "TKO")], p, [m], [badNote]));
  assert.equal(profile.stats.records.bestLeg, null);
  assert.equal(profile.history[0].bestLeg, null);
  assert.equal(profile.stats.scoring.first9Average, null);
});