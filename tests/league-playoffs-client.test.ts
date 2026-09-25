import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import {
  PLAYOFF_QUERY_REFRESH,
  defaultPlayoffFilters,
  filterAndSortPlayers,
  playoffQueryKey,
  readPlayoffFilters,
  safePlayoffsReturnPath,
  serializePlayoffFilters,
  type PlayoffFilters,
  type PlayoffPlayer,
} from "../client/src/lib/league-playoffs";

const row = (overrides: Partial<PlayoffPlayer> & Pick<PlayoffPlayer, "identity" | "name" | "position">): PlayoffPlayer => ({
  identity: overrides.identity,
  name: overrides.name,
  position: overrides.position,
  points: 0,
  profilePlayerId: null,
  qualification: "not-automatic",
  tournamentsAttended: null,
  totalTournaments: 4,
  attendancePercentage: null,
  membership: "unknown",
  tournamentWins: null,
  runnerUp: null,
  threeDartAverage: null,
  bestTournamentAverage: null,
  first9Average: null,
  highestCheckout: null,
  bestLeg: null,
  oneEighties: null,
  matchWinPercentage: null,
  legWinPercentage: null,
  ...overrides,
});

const allFilters = (overrides: Partial<PlayoffFilters> = {}): PlayoffFilters => ({
  ...defaultPlayoffFilters(false),
  ...overrides,
});

test("unknown membership and attendance stay unknown in filters", () => {
  const players = [
    row({ identity: "member", name: "Member", position: 1, membership: "member", attendancePercentage: 60 }),
    row({ identity: "non", name: "Non-member", position: 2, membership: "non-member", attendancePercentage: 50 }),
    row({ identity: "unknown", name: "Manual result", position: 3 }),
  ];

  assert.deepEqual(filterAndSortPlayers(players, allFilters({ membership: "all" })).length, 3);
  assert.deepEqual(filterAndSortPlayers(players, allFilters({ membership: "member" })).map(p => p.name), ["Member"]);
  assert.deepEqual(filterAndSortPlayers(players, allFilters({ membership: "non-member" })).map(p => p.name), ["Non-member"]);
  assert.deepEqual(filterAndSortPlayers(players, allFilters({ minAttendance: 0 })).length, 3);
  assert.deepEqual(filterAndSortPlayers(players, allFilters({ minAttendance: 60 })).map(p => p.name), ["Member"]);
});

test("winner and minimum tournament filters do not infer missing values", () => {
  const players = [
    row({ identity: "won", name: "Winner", position: 1, tournamentWins: 2, tournamentsAttended: 2 }),
    row({ identity: "zero", name: "No wins", position: 2, tournamentWins: 0, tournamentsAttended: 1 }),
    row({ identity: "unknown", name: "Unknown", position: 3 }),
  ];

  assert.deepEqual(filterAndSortPlayers(players, allFilters({ winner: "won" })).map(p => p.name), ["Winner"]);
  assert.deepEqual(filterAndSortPlayers(players, allFilters({ winner: "not-won" })).map(p => p.name), ["No wins"]);
  assert.deepEqual(filterAndSortPlayers(players, allFilters({ minTournaments: 1 })).map(p => p.name), ["Winner", "No wins"]);
  assert.deepEqual(filterAndSortPlayers(players, allFilters({ minTournaments: 0 })).length, 3);
});

test("unknown numeric values sort last in both directions and best leg prefers fewer darts", () => {
  const players = [
    row({ identity: "unknown", name: "Unknown", position: 1 }),
    row({ identity: "low", name: "Low", position: 2, points: 10, bestLeg: 24 }),
    row({ identity: "high", name: "High", position: 3, points: 20, bestLeg: 15 }),
  ];

  assert.deepEqual(
    filterAndSortPlayers(players, allFilters({ sort: "bestLeg", direction: "asc" })).map(p => p.name),
    ["High", "Low", "Unknown"],
  );
  assert.deepEqual(
    filterAndSortPlayers(players, allFilters({ sort: "bestLeg", direction: "desc" })).map(p => p.name),
    ["Low", "High", "Unknown"],
  );
});

test("filter defaults and URL state preserve every control and sort direction", () => {
  assert.equal(defaultPlayoffFilters(true).qualification, "not-automatic");
  assert.equal(defaultPlayoffFilters(false).qualification, "all");
  const filters = allFilters({
    search: "Alice Smith",
    minAttendance: 70,
    membership: "member",
    qualification: "automatic",
    minTournaments: 3,
    winner: "won",
    sort: "first9Average",
    direction: "asc",
  });
  const parsed = readPlayoffFilters(`?${serializePlayoffFilters(filters)}`, false);
  assert.deepEqual(parsed, filters);
});

test("profile return paths are restricted to the same league playoffs route", () => {
  assert.equal(
    safePlayoffsReturnPath("/leagues/12/playoffs?q=Smith&attendance=50", 12),
    "/leagues/12/playoffs?q=Smith&attendance=50",
  );
  assert.equal(safePlayoffsReturnPath("/leagues/13/playoffs", 12), null);
  assert.equal(safePlayoffsReturnPath("//evil.example/leagues/12/playoffs", 12), null);
  assert.equal(safePlayoffsReturnPath("https://evil.example/leagues/12/playoffs", 12), null);
  assert.equal(safePlayoffsReturnPath("/leagues/12", 12), null);
});

test("membership edit invalidates the same owner and league cache used on return to Playoffs", async () => {
  const cache = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  const key = playoffQueryKey(7, 12);
  const otherOwner = playoffQueryKey(8, 12);
  cache.setQueryData(key, { players: [{ membership: "unknown" }] });
  cache.setQueryData(otherOwner, { players: [{ membership: "unknown" }] });
  assert.equal(cache.getQueryState(key)?.isInvalidated, false);
  await cache.invalidateQueries({ queryKey: playoffQueryKey(7, 12) });
  assert.equal(cache.getQueryState(key)?.isInvalidated, true);
  assert.equal(cache.getQueryState(otherOwner)?.isInvalidated, false);

  const filters = allFilters({ search: "Alice", membership: "member", minAttendance: 40, direction: "desc" });
  const returnPath = `/leagues/12/playoffs?${serializePlayoffFilters(filters)}`;
  const validatedPath = safePlayoffsReturnPath(returnPath, 12);
  assert.equal(validatedPath, returnPath);
  assert.deepEqual(readPlayoffFilters(new URL(validatedPath!, "https://local.invalid").search, false), filters);
});

test("returning to Playoffs refetches a changed cutoff and new standings player despite an infinite cache", async () => {
  const cache = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, refetchOnWindowFocus: false } } });
  const key = playoffQueryKey(7, 12);
  let response = { league: { promotionCount: 1 }, players: ["Alice", "Bob"] };
  let fetches = 0;
  const options = {
    queryKey: key,
    queryFn: async () => { fetches++; return response; },
    ...PLAYOFF_QUERY_REFRESH,
  };
  const first = new QueryObserver(cache, options);
  const firstResult = new Promise<typeof response>(resolve => {
    const unsubscribe = first.subscribe(result => {
      if (result.isSuccess && !result.isFetching) {
        unsubscribe();
        resolve(result.data!);
      }
    });
  });
  assert.deepEqual(await firstResult, response);
  response = { league: { promotionCount: 2 }, players: ["Alice", "Bob", "Casey"] };
  const second = new QueryObserver(cache, options);
  const secondResult = new Promise<typeof response>(resolve => {
    const unsubscribe = second.subscribe(result => {
      if (result.isSuccess && !result.isFetching) {
        unsubscribe();
        resolve(result.data!);
      }
    });
  });
  assert.deepEqual(await secondResult, response);
  assert.equal(fetches, 2);
});