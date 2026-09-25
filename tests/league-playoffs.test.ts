import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  League, LeagueManualResult, LeaguePlayerMembership, Match, MatchNote, Player, Tournament,
} from "../shared/schema";
import { buildLeaguePlayoffsData, getLeaguePlayoffStandings, normalizeCurrentPlayoffIdentity } from "../server/league-playoffs";
import { calculateLeagueStandings } from "../server/league-standings";
import type { LeagueProfileSource } from "../server/storage";

const league = {
  id: 1, userId: 7, name: "League", promotionCount: 1, startDate: null, endDate: null,
} as League;

function tournament(id: number, name: string, status = "COMPLETED"): Tournament {
  return {
    id, leagueId: league.id, name, status,
    eventDate: `2026-09-${String(id).padStart(2, "0")}`,
    createdAt: new Date(`2026-09-${String(id).padStart(2, "0")}`),
  } as Tournament;
}

function player(id: number, tournamentId: number, name: string): Player {
  return { id, tournamentId, name, seed: null };
}

function match(id: number, tournamentId: number, a: number, b: number, winner: number): Match {
  return {
    id, tournamentId, playerAId: a, playerBId: b, winnerId: winner,
    status: "COMPLETED", stage: "KNOCKOUT", roundKey: "F",
    scoreA: 3, scoreB: 2, groupId: null, bestOf: 5, order: 0,
  } as Match;
}

function makeSource(): LeagueProfileSource {
  const t = tournament(1, "Night 1");
  return {
    tournaments: [t],
    players: [player(11, t.id, "Alice Smith"), player(12, t.id, "Bob Jones")],
    matches: [match(101, t.id, 11, 12, 11)],
    notes: [] as MatchNote[],
    manualResults: [{
      playerName: "Casey Manual", tournamentLabel: "Imported night",
      points: 100, legsWon: 0, legsLost: 0,
    }] as LeagueManualResult[],
  };
}

test("playoffs rows reuse profile statistics and preserve unknown manual-only data", () => {
  const source = makeSource();
  const memberships = [{
    id: 1, leagueId: league.id, normalizedPlayerIdentity: "bob jones",
    isClubMember: false, membershipConfirmedAt: null,
  }] as LeaguePlayerMembership[];
  const data = buildLeaguePlayoffsData(
    league, source, memberships, ["bob jones", "casey manual", "removed player"],
  );

  assert.equal(data.totalTournaments, 1);
  assert.deepEqual(data.players.map(row => [row.name, row.position, row.points]), [
    ["Casey Manual", 1, 100],
    ["Alice Smith", 2, 40],
    ["Bob Jones", 3, 30],
  ]);
  assert.equal(data.players[0].profilePlayerId, null);
  assert.equal(data.players[0].qualification, "automatic");
  assert.equal(data.players[0].tournamentsAttended, null);
  assert.equal(data.players[0].attendancePercentage, null);
  assert.equal(data.players[0].membership, "unknown");
  assert.equal(data.players[0].tournamentWins, null);
  assert.equal(data.players[0].runnerUp, null);
  assert.equal(data.players[0].threeDartAverage, null);
  assert.equal(data.players[0].bestTournamentAverage, null);
  assert.equal(data.players[0].first9Average, null);
  assert.equal(data.players[0].highestCheckout, null);
  assert.equal(data.players[0].bestLeg, null);
  assert.equal(data.players[0].oneEighties, null);
  assert.equal(data.players[0].matchWinPercentage, null);
  assert.equal(data.players[0].legWinPercentage, null);

  assert.equal(data.players[1].profilePlayerId, 11);
  assert.equal(data.players[1].tournamentsAttended, 1);
  assert.equal(data.players[1].attendancePercentage, 100);
  assert.equal(data.players[1].membership, "unknown");
  assert.equal(data.players[1].tournamentWins, 1);
  assert.equal(data.players[1].qualification, "not-automatic");
  assert.equal(data.players[2].runnerUp, 1);
  assert.equal(data.players[2].membership, "non-member");
  assert.deepEqual(data.selectedIdentities, ["casey manual", "bob jones"]);
});

test("unconfigured promotion has no automatic qualification status", () => {
  const data = buildLeaguePlayoffsData(
    { ...league, promotionCount: 0 },
    makeSource(),
    [],
    [],
  );
  assert.ok(data.players.every(row => row.qualification === "unconfigured"));
  assert.equal(data.league.promotionCount, 0);
});

test("an exact tie at the automatic-place cutoff follows the existing standings player order", () => {
  const t = tournament(2, "Night 2");
  const alice = player(21, t.id, "Alice");
  const bob = player(22, t.id, "Bob");
  // Bulk DB results need not arrive in insertion order; the standings route
  // reads tournament players by ID, and a complete tie retains that order.
  const source: LeagueProfileSource = {
    tournaments: [t], players: [bob, alice], matches: [], notes: [], manualResults: [],
  };
  const existingStandings = calculateLeagueStandings([
    { tournament: t, players: [alice, bob], matches: [] },
  ], []);
  const playoffs = buildLeaguePlayoffsData(league, source, [], []);
  assert.deepEqual(getLeaguePlayoffStandings(source).map(row => row.name), existingStandings.map(row => row.name));
  assert.deepEqual(playoffs.players.map(row => [row.name, row.position, row.qualification]), [
    ["Alice", 1, "automatic"],
    ["Bob", 2, "not-automatic"],
  ]);
});

test("shortlist identity validation uses the standings normalizer and rejects unknown players", () => {
  const source = makeSource();
  assert.equal(normalizeCurrentPlayoffIdentity("  ALICE   SMITH ", source), "alice smith");
  assert.equal(normalizeCurrentPlayoffIdentity("CASEY MANUAL", source), "casey manual");
  assert.equal(normalizeCurrentPlayoffIdentity("Alice Elsewhere", source), null);
  assert.equal(normalizeCurrentPlayoffIdentity("another league player", source), null);
  assert.equal(normalizeCurrentPlayoffIdentity("", source), null);
  assert.equal(normalizeCurrentPlayoffIdentity(12, source), null);
});