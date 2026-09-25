import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { queryClient } from "../client/src/lib/queryClient";

test("scorer remount fetches fresh board-data before hydrating from a cached unfinished leg", async () => {
  // The real app defaults and scorer page key/options. This models a remount
  // in the same QueryClient: another scorer changed the server state while
  // the old board-data response was cached.
  const cache = new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });
  const key = ["/api/scorer/board-data"];
  const old = { matches: [{ id: 42, scoringVersion: 1, currentLegState: null }] };
  const authoritative = { matches: [{ id: 42, scoringVersion: 1, currentLegState: {
    remainingA: 441, remainingB: 501, visits: [{ player: "A", score: 60 }],
    currentThrower: "B", legStartingThrower: "A",
  } }] };
  cache.setQueryData(key, old);
  let serverReads = 0;
  const observer = new QueryObserver(cache, {
    queryKey: key,
    queryFn: async () => { serverReads++; return authoritative; },
    refetchInterval: 10000,
    refetchOnMount: "always",
  });
  const unsubscribe = observer.subscribe(() => {});
  try {
    await new Promise(resolve => setTimeout(resolve, 40));
    assert.equal(serverReads, 1, "remount must read the server before using cached scoring state");
    assert.deepEqual(observer.getCurrentResult().data, authoritative);
  } finally {
    unsubscribe();
    cache.clear();
  }
});