import assert from "node:assert/strict";
import test from "node:test";
import {
  getThirdPlaceBoardNumber,
  getThirdPlaceBracketRounds,
  getThirdPlaceByeProgressionUpdates,
  getThirdPlaceProgressionUpdate,
  getThirdPlaceQualifierIds,
  getThirdPlaceSeedUpdates,
  shouldCompleteTournament,
  usesThirdPlaceBoardSplit,
  type ThirdPlaceBracketMatch,
} from "../server/third-place-bracket";

const groupCounts = [2, 3, 4, 5, 6, 7, 8];

function makeGroupStage(groupCount: number) {
  const groups = Array.from({ length: groupCount }, (_, i) => ({ id: i + 1 }));
  const players = groups.flatMap(group =>
    [1, 2, 3].map(position => ({ id: group.id * 100 + position })),
  );
  const memberships = groups.flatMap(group =>
    [1, 2, 3].map(position => ({
      groupId: group.id,
      playerId: group.id * 100 + position,
    })),
  );
  const matches = groups.flatMap(group => {
    const [first, second, third] = [1, 2, 3].map(position => group.id * 100 + position);
    return [
      { groupId: group.id, playerAId: first, playerBId: second, scoreA: 2, scoreB: 0, winnerId: first, status: "COMPLETED" },
      { groupId: group.id, playerAId: first, playerBId: third, scoreA: 2, scoreB: 0, winnerId: first, status: "COMPLETED" },
      { groupId: group.id, playerAId: second, playerBId: third, scoreA: 2, scoreB: 0, winnerId: second, status: "COMPLETED" },
    ];
  });
  return { groups, players, memberships, matches };
}

function makeBracket(groupCount: number): ThirdPlaceBracketMatch[] {
  let id = 1000;
  let order = 100;
  return getThirdPlaceBracketRounds(groupCount).flatMap(round =>
    Array.from({ length: round.matchCount }, () => ({
      id: id++,
      stage: "KNOCKOUT",
      roundKey: round.roundKey,
      order: order++,
      playerAId: null,
      playerBId: null,
      scoreA: 0,
      scoreB: 0,
      bestOf: 3,
      status: "PENDING",
      winnerId: null,
      boardNumber: null,
    })),
  );
}

function applyUpdates(
  matches: ThirdPlaceBracketMatch[],
  updates: Array<{ matchId: number; updates: Partial<ThirdPlaceBracketMatch> }>,
) {
  for (const update of updates) {
    const match = matches.find(item => item.id === update.matchId);
    assert.ok(match, `expected match ${update.matchId} to exist`);
    Object.assign(match, update.updates);
  }
}

for (const groupCount of groupCounts) {
  for (const scheduleMode of ["standard", "board_rotation"] as const) {
    test(`${groupCount} groups, ${scheduleMode}: qualifies third place and advances to champion`, () => {
      const groupStage = makeGroupStage(groupCount);
      const qualifiers = getThirdPlaceQualifierIds(
        groupStage.groups,
        groupStage.memberships,
        groupStage.players,
        groupStage.matches,
        2,
        0,
      );
      assert.equal(qualifiers.length, groupCount);
      assert.deepEqual(
        qualifiers,
        groupStage.groups.map(group => group.id * 100 + 3),
      );

      const tpMatches = makeBracket(groupCount);
      const mainFinal: ThirdPlaceBracketMatch = {
        id: 99,
        stage: "KNOCKOUT",
        roundKey: "F",
        order: 99,
        playerAId: 1,
        playerBId: 2,
        scoreA: 0,
        scoreB: 0,
        bestOf: 3,
        status: "PENDING",
        winnerId: null,
      };
      const allMatches = [...tpMatches, mainFinal];
      const seedUpdates = getThirdPlaceSeedUpdates(tpMatches, qualifiers);
      applyUpdates(tpMatches, seedUpdates);

      const firstRoundKey = getThirdPlaceBracketRounds(groupCount)[0].roundKey;
      const firstRound = tpMatches.filter(match => match.roundKey === firstRoundKey);
      const expectedByes = Math.pow(2, Math.ceil(Math.log2(groupCount))) - groupCount;
      assert.equal(
        seedUpdates.filter(update => update.updates.status === "COMPLETED").length,
        expectedByes,
      );
      assert.ok(firstRound.every(match => match.playerAId !== null));

      const byeUpdates = getThirdPlaceByeProgressionUpdates(
        tpMatches,
        seedUpdates.map(update => update.matchId),
      );
      applyUpdates(tpMatches, byeUpdates);

      const rounds = getThirdPlaceBracketRounds(groupCount);
      for (const round of rounds) {
        const roundMatches = tpMatches
          .filter(match => match.roundKey === round.roundKey)
          .sort((a, b) => a.order - b.order);
        for (const match of roundMatches) {
          if (match.status === "COMPLETED") continue;
          assert.ok(match.playerAId, `${round.roundKey} match ${match.id} has player A`);
          assert.ok(match.playerBId, `${round.roundKey} match ${match.id} has player B`);
          match.winnerId = match.playerAId;
          match.scoreA = 1;
          match.scoreB = 0;
          match.status = "COMPLETED";
          const advancement = getThirdPlaceProgressionUpdate(
            allMatches,
            match.id,
            match.winnerId,
          );
          if (advancement) applyUpdates(allMatches, [advancement]);
        }
      }

      const final = tpMatches.find(match => match.roundKey === "TP_F");
      assert.ok(final?.winnerId, "the consolation final declares a winner");
      assert.equal(
        shouldCompleteTournament(allMatches, true),
        false,
        "the tournament waits for its main final",
      );
      mainFinal.winnerId = mainFinal.playerAId;
      mainFinal.status = "COMPLETED";
      assert.equal(shouldCompleteTournament(allMatches, true), true);
      assert.equal(shouldCompleteTournament(allMatches, false), true);
      assert.equal(mainFinal.winnerId, 1, "consolation progression does not change the main final");

      const settings = scheduleMode === "standard"
        ? { groupScheduleMode: "standard" as const }
        : {
            groupScheduleMode: "board_rotation" as const,
            numberOfBoards: groupCount % 2 === 0 ? groupCount / 2 : 2,
          };
      const boardCount = settings.numberOfBoards || groupCount;
      const roundCount = getThirdPlaceBracketRounds(groupCount)[0].matchCount;
      const assignedBoards = Array.from({ length: roundCount }, (_, index) =>
        getThirdPlaceBoardNumber(index, groupCount, settings),
      );
      if (scheduleMode === "board_rotation" && usesThirdPlaceBoardSplit(groupCount, settings)) {
        assert.ok(assignedBoards.every(board => board > boardCount / 2 && board <= boardCount));
      } else if (scheduleMode === "board_rotation" && boardCount * 2 === groupCount) {
        assert.ok(assignedBoards.every(board => board >= 1 && board <= boardCount));
      } else {
        assert.ok(assignedBoards.every(board => board >= 1 && board <= groupCount));
      }
    });
  }
}

test("two-group consolation bracket is a direct final", () => {
  assert.deepEqual(getThirdPlaceBracketRounds(2), [{ roundKey: "TP_F", matchCount: 1 }]);
});

test("eight-group consolation pairings retain the existing group order", () => {
  const matches = makeBracket(8);
  const updates = getThirdPlaceSeedUpdates(
    matches,
    [103, 203, 303, 403, 503, 603, 703, 803],
  );
  assert.deepEqual(
    updates.slice(0, 4).map(({ updates: seed }) => [seed.playerAId, seed.playerBId]),
    [
      [103, 203],
      [303, 403],
      [503, 603],
      [703, 803],
    ],
  );
});

test("the consolation final gates tournament completion only when enabled", () => {
  const final: ThirdPlaceBracketMatch = {
    id: 1,
    stage: "KNOCKOUT",
    roundKey: "F",
    order: 1,
    playerAId: 1,
    playerBId: 2,
    scoreA: 3,
    scoreB: 1,
    bestOf: 5,
    status: "COMPLETED",
    winnerId: 1,
  };
  const thirdPlaceFinal: ThirdPlaceBracketMatch = {
    ...final,
    id: 2,
    roundKey: "TP_F",
    order: 2,
    status: "PENDING",
    winnerId: null,
  };
  assert.equal(shouldCompleteTournament([final, thirdPlaceFinal], false), true);
  assert.equal(shouldCompleteTournament([final, thirdPlaceFinal], true), false);
});

test("bracket generation ignores counts below two", () => {
  assert.deepEqual(getThirdPlaceBracketRounds(1), []);
});
