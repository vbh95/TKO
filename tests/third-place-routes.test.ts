import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { api } from "../shared/routes";

// Bundle the real routes/generator with storage replaced before evaluation.
// No application database module is loaded, and no network/database is used.
const bundle = await build({
  entryPoints: ["server/routes.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  packages: "external",
  plugins: [{
    name: "isolated-bracket-storage",
    setup(builder) {
      builder.onResolve({ filter: /^\.\/(storage|socket|db)$/ }, args => ({
        path: args.path,
        namespace: "test-double",
      }));
      builder.onLoad({ filter: /.*/, namespace: "test-double" }, args => ({
        contents: args.path === "./storage"
          ? "export const storage = TEST_STORAGE;"
          : args.path === "./db"
            ? 'throw new Error("Database access is forbidden in bracket route tests"); export const db = null; export const pool = null;'
            : `export const liveScoringCache = new Map();
               ${["emitMatchUpdate", "emitTournamentUpdate", "emitBoardMatchUpdate",
                 "emitLegScoring", "clearLiveScoringCache", "clearLiveScoringForTournament"]
                 .map(name => `export const ${name} = () => {};`).join("\n")}`,
        loader: "js",
      }));
    },
  }],
});

async function harness() {
  const rows: Record<string, any[]> = {
    tournaments: [], players: [], groups: [], memberships: [], matches: [],
  };
  const copy = (value: any) => structuredClone(value);
  const insert = (table: string, value: any) => {
    const row = { id: rows[table].length + 1, ...copy(value) };
    if (table === "matches") Object.assign(row, {
      boardNumber: null, scorerId: null, scorerName: null, ...copy(value),
    });
    rows[table].push(row);
    return copy(row);
  };
  const patch = (table: string, id: number, update: any) => {
    const row = rows[table].find(item => item.id === id);
    assert.ok(row, `missing ${table} record ${id}`);
    Object.assign(row, copy(update));
    return copy(row);
  };
  const storage = new Proxy({
    sessionStore: undefined,
    getAllTournaments: async () => [],
    createTournament: async (value: any) => insert("tournaments", value),
    createPlayer: async (value: any) => insert("players", value),
    createGroup: async (value: any) => insert("groups", value),
    createGroupMembership: async (value: any) => insert("memberships", value),
    createMatch: async (value: any) => insert("matches", value),
    updateMatch: async (id: number, value: any) => patch("matches", id, value),
    updateTournament: async (id: number, value: any) => patch("tournaments", id, value),
    getTournament: async (id: number) => copy(rows.tournaments.find(item => item.id === id)),
    getMatch: async (id: number) => copy(rows.matches.find(item => item.id === id)),
    getMatchesByTournamentId: async (id: number) => copy(rows.matches.filter(item => item.tournamentId === id)),
    getGroupsByTournamentId: async (id: number) => copy(rows.groups.filter(item => item.tournamentId === id)),
    getPlayersByTournamentId: async (id: number) => copy(rows.players.filter(item => item.tournamentId === id)),
    getGroupMembershipsByTournamentId: async () => copy(rows.memberships),
  }, {
    get(target, key) {
      if (key in target) return target[key as keyof typeof target];
      throw new Error(`Unmocked storage access: ${String(key)}`);
    },
  });
  const module = { exports: {} as any };
  new Function("require", "module", "exports", "TEST_STORAGE", bundle.outputFiles[0].text)(
    createRequire(import.meta.url), module, module.exports, storage,
  );
  const handlers = new Map<string, Function>();
  const app = Object.fromEntries(["get", "post", "put", "patch", "delete", "use"].map(method => [
    method,
    (path: string, ...callbacks: Function[]) => {
      if (method !== "use") handlers.set(`${method} ${path}`, callbacks.at(-1)!);
    },
  ]));
  await module.exports.registerRoutes({}, app);
  const request = async (method: string, path: string, body: any, params = {}, boardSession?: any, allowError = false) => {
    const handler = handlers.get(`${method} ${path}`);
    assert.ok(handler, `missing route ${path}`);
    const res = {
      code: 200,
      data: undefined as any,
      status(code: number) { this.code = code; return this; },
      json(data: any) { this.data = data; return this; },
    };
    await handler({ body, params, user: { id: 1 }, boardSession }, res);
    assert.ok(allowError || res.code < 400, `${path}: ${res.code} ${JSON.stringify(res.data)}`);
    return res.data;
  };
  return { rows, request };
}

test("invalid consolation setup is rejected before creating records", async () => {
  for (const groupCount of [1, 2, 3]) {
    const { rows, request } = await harness();
    const response = await request("post", api.tournaments.create.path, {
      name: "Invalid setup", type: "MULTI_STAGE", randomize: false,
      playerNames: ["A", "B", "C", "D"],
      settings: { groupCount, enableThirdPlaceBracket: true },
    }, {}, undefined, true);
    assert.ok(response.message.includes(groupCount === 1 ? "two groups" : "three players"));
    assert.equal(rows.tournaments.length, 0);
    assert.equal(rows.matches.length, 0);
  }
});

for (const rotation of [false, true]) {
  test(`disabled consolation keeps the main bracket standalone, rotation ${rotation}`, async () => {
    const { rows, request } = await harness();
    await request("post", api.tournaments.create.path, {
      name: "Feature disabled", type: "MULTI_STAGE", randomize: false,
      playerNames: Array.from({ length: 24 }, (_, i) => `Player ${i + 1}`),
      settings: {
        groupCount: 8, promotedPerGroup: 2, seeded: true,
        enableThirdPlaceBracket: false,
        groupScheduleMode: rotation ? "board_rotation" : "standard",
        numberOfBoards: rotation ? 4 : undefined,
      },
    });
    assert.ok(rows.matches.every(m => !m.roundKey.startsWith("TP_")));
    for (const match of rows.matches) {
      assert.ok(match.playerAId && match.playerBId);
      const aWins = match.stage !== "GROUP" || match.playerAId < match.playerBId;
      await request("put", api.matches.update.path,
        { scoreA: aWins ? 2 : 0, scoreB: aWins ? 0 : 2 }, { id: `${match.id}` });
    }
    assert.equal(rows.tournaments[0].status, "COMPLETED");
  });
}

test("correcting and resetting consolation results clears dependent winners only", async () => {
  const { rows, request } = await harness();
  await request("post", api.tournaments.create.path, {
    name: "Reset result", type: "MULTI_STAGE", randomize: false,
    playerNames: Array.from({ length: 24 }, (_, i) => `Player ${i + 1}`),
    settings: { groupCount: 8, promotedPerGroup: 2, enableThirdPlaceBracket: true },
  });
  for (const match of rows.matches) {
    assert.ok(match.playerAId && match.playerBId);
    const aWins = match.stage !== "GROUP" || match.playerAId < match.playerBId;
    await request("put", api.matches.update.path,
      { scoreA: aWins ? 2 : 0, scoreB: aWins ? 0 : 2 }, { id: `${match.id}` });
  }
  const mainResults = structuredClone(rows.matches.filter(m =>
    m.stage === "KNOCKOUT" && !m.roundKey.startsWith("TP_")));
  const quarter = rows.matches.find(m => m.roundKey === "TP_QF");
  await request("put", api.matches.update.path, { scoreA: 0, scoreB: 2 }, { id: `${quarter.id}` });
  assert.equal(quarter.winnerId, quarter.playerBId);
  assert.equal(rows.matches.find(m => m.roundKey === "TP_F").winnerId, null);
  assert.equal(rows.tournaments[0].status, "IN_PROGRESS");
  await request("put", api.matches.update.path, { scoreA: 0, scoreB: 0 }, { id: `${quarter.id}` });
  for (const roundKey of ["TP_QF", "TP_SF", "TP_F"]) {
    const match = rows.matches.find(m => m.roundKey === roundKey);
    assert.equal(match.winnerId, null);
    assert.equal(match.status, "PENDING");
  }
  assert.equal(rows.tournaments[0].status, "IN_PROGRESS");
  // Scorer assignments may be refreshed globally; participants/results must not change.
  assert.deepEqual(rows.matches.filter(m => m.stage === "KNOCKOUT" && !m.roundKey.startsWith("TP_"))
    .map(({ scorerId, scorerName, ...m }) => m),
  mainResults.map(({ scorerId, scorerName, ...m }) => m));
});

for (let groupCount = 2; groupCount <= 8; groupCount++) {
  for (const rotation of [false, true]) {
    for (const resultMode of ["admin", "scorer"] as const) {
      test(`real routes: ${groupCount} groups, rotation ${rotation}, ${resultMode} through both finals`, async () => {
        const { rows, request } = await harness();
        await request("post", api.tournaments.create.path, {
          name: "Isolated bracket test", type: "MULTI_STAGE", randomize: false,
          playerNames: Array.from({ length: groupCount * 3 }, (_, i) => `Player ${i + 1}`),
          settings: {
            groupCount, promotedPerGroup: 2, seeded: true,
            enableThirdPlaceBracket: true,
            groupScheduleMode: rotation ? "board_rotation" : "standard",
            numberOfBoards: rotation ? Math.max(1, Math.floor(groupCount / 2)) : undefined,
            groupBestOf: 3, knockoutBestOf: 3,
          },
        });
        const result = async (match: any) => {
          const aWins = match.stage !== "GROUP" || match.playerAId < match.playerBId;
          const scoreA = aWins ? Math.ceil(match.bestOf / 2) : 0;
          const scoreB = aWins ? 0 : Math.ceil(match.bestOf / 2);
          if (resultMode === "admin") {
            await request("put", api.matches.update.path, { scoreA, scoreB }, { id: `${match.id}` });
          } else {
            // Start-state is normally set by the scorer's separate start endpoint.
            match.status = "IN_PROGRESS";
            await request("put", "/api/scorer/matches/:matchId", { scoreA, scoreB },
              { matchId: `${match.id}` }, { tournamentId: 1, boardNumber: match.boardNumber || 1 });
          }
        };
        for (const match of rows.matches.filter(m => m.stage === "GROUP")) await result(match);
        const tp = rows.matches.filter(m => m.roundKey.startsWith("TP_"));
        const main = rows.matches.filter(m => m.stage === "KNOCKOUT" && !m.roundKey.startsWith("TP_"));
        const qualifiers = new Set(tp.flatMap(m => [m.playerAId, m.playerBId]).filter(Boolean));
        assert.deepEqual([...qualifiers].sort((a, b) => a - b),
          Array.from({ length: groupCount }, (_, i) => (i + 1) * 3));
        assert.equal(tp.filter(m => m.status === "COMPLETED").length,
          2 ** Math.ceil(Math.log2(groupCount)) - groupCount);
        for (const match of tp) {
          assert.ok(match.boardNumber >= 1 && match.boardNumber <= groupCount);
          if (!rotation) {
            const sameRound = tp.filter(m => m.roundKey === match.roundKey);
            assert.equal(match.boardNumber, sameRound.indexOf(match) + 1);
          }
        }
        if (groupCount === 8 && rotation) {
          assert.deepEqual(main.slice(0, 8).map(m => [m.playerAId, m.playerBId]),
            [[1, 23], [4, 20], [7, 17], [10, 14], [13, 11], [16, 8], [19, 5], [22, 2]]);
          assert.deepEqual(tp.slice(0, 4).map(m => m.boardNumber), [3, 4, 3, 4]);
        }
        for (const match of main) {
          if (match.status === "COMPLETED") continue;
          assert.ok(match.playerAId && match.playerBId, `main ${match.roundKey} is playable`);
          await result(match);
        }
        assert.notEqual(rows.tournaments[0].status, "COMPLETED", "waits for consolation final");
        const mainResults = main.map(m => ({
          id: m.id, playerAId: m.playerAId, playerBId: m.playerBId,
          winnerId: m.winnerId, scoreA: m.scoreA, scoreB: m.scoreB, status: m.status,
        }));
        for (const match of tp) {
          if (match.status === "COMPLETED") continue;
          assert.ok(match.playerAId && match.playerBId, `consolation ${match.roundKey} is playable`);
          await result(match);
        }
        assert.ok(tp.find(m => m.roundKey === "TP_F").winnerId);
        assert.equal(rows.tournaments[0].status, "COMPLETED");
        assert.deepEqual(main.map(m => ({
          id: m.id, playerAId: m.playerAId, playerBId: m.playerBId,
          winnerId: m.winnerId, scoreA: m.scoreA, scoreB: m.scoreB, status: m.status,
        })), mainResults, "consolation never changes main participants or results");
      });
    }
  }
}
