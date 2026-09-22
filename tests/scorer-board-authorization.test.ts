import test from "node:test";
import assert from "node:assert/strict";
import {
  assertScorerMatchAssignedToBoard,
  getScorerBoardAssignment,
  isScorerMatchAssignedToBoard,
  ScorerBoardAuthorizationError,
} from "../server/scorer-board-authorization";

const group = (id: number, name = `Group ${String.fromCharCode(64 + id)}`) => ({ id, name });
const match = (
  id: number,
  stage: string,
  options: Partial<{ groupId: number | null; boardNumber: number | null; roundKey: string; order: number; status: string }> = {},
) => ({
  id,
  stage,
  groupId: options.groupId ?? null,
  boardNumber: options.boardNumber ?? null,
  roundKey: options.roundKey ?? "group",
  order: options.order ?? id,
  status: options.status ?? "PENDING",
});

test("standard assignment includes natural primary-group and explicit guest matches", () => {
  const assignment = getScorerBoardAssignment(
    {},
    [group(1), group(2)],
    [
      match(1, "GROUP", { groupId: 1 }),
      match(2, "GROUP", { groupId: 1, boardNumber: 2 }),
      match(3, "GROUP", { groupId: 2, boardNumber: 1 }),
    ],
    1,
  );

  assert.equal(assignment.primaryGroup.id, 1);
  assert.deepEqual(assignment.groupMatches.map(m => m.id), [1]);
  assert.deepEqual(assignment.guestGroupMatches.map(m => m.id), [3]);
  assert.deepEqual(assignment.reassignedGroupMatches.map(m => m.id), [2]);
  assert.deepEqual(assignment.assignedMatchIds, [1, 3]);
  assert.equal(assignment.totalBoards, 2);
});

test("an explicitly reassigned group match is authorized only on its new board", () => {
  const matches = [match(10, "GROUP", { groupId: 1, boardNumber: 2 })];
  const boardOne = getScorerBoardAssignment({}, [group(1), group(2)], matches, 1);
  const boardTwo = getScorerBoardAssignment({}, [group(1), group(2)], matches, 2);

  assert.deepEqual(boardOne.assignedMatchIds, []);
  assert.deepEqual(boardTwo.assignedMatchIds, [10]);
  assert.equal(isScorerMatchAssignedToBoard(10, boardTwo), true);
});

test("board rotation uses explicit board assignments and two groups per board", () => {
  const assignment = getScorerBoardAssignment(
    { groupScheduleMode: "board_rotation", numberOfBoards: 2 },
    [group(1), group(2), group(3), group(4)],
    [
      match(20, "GROUP", { groupId: 1, boardNumber: 1 }),
      match(21, "GROUP", { groupId: 2, boardNumber: 1 }),
      match(22, "GROUP", { groupId: 3, boardNumber: 2 }),
      match(23, "GROUP", { groupId: 4, boardNumber: 2 }),
    ],
    2,
  );

  assert.equal(assignment.primaryGroup.id, 3);
  assert.deepEqual(assignment.groupMatches.map(m => m.id), [22, 23]);
  assert.deepEqual(assignment.guestGroupMatches, []);
  assert.deepEqual(assignment.assignedMatchIds, [22, 23]);
  assert.equal(assignment.totalBoards, 2);
  assert.equal(assignment.isBoardRotation, true);
});

test("mixed tournament knockout assignment uses explicit boardNumber", () => {
  const assignment = getScorerBoardAssignment(
    {},
    [group(1), group(2)],
    [match(30, "KNOCKOUT", { boardNumber: 2, roundKey: "QF" })],
    2,
  );
  assert.deepEqual(assignment.knockoutMatches.map(m => m.id), [30]);
  assert.equal(isScorerMatchAssignedToBoard(30, assignment), true);
});

test("knockout-only configured boards use per-round modular assignment", () => {
  const assignment = getScorerBoardAssignment(
    { numBoards: 2 },
    [],
    [
      match(40, "KNOCKOUT", { roundKey: "QF", order: 1 }),
      match(41, "KNOCKOUT", { roundKey: "QF", order: 2 }),
      match(42, "KNOCKOUT", { roundKey: "QF", order: 3 }),
      match(43, "KNOCKOUT", { roundKey: "SF", order: 4 }),
      match(44, "KNOCKOUT", { roundKey: "F", order: 5 }),
    ],
    1,
  );
  assert.deepEqual(assignment.knockoutMatches.map(m => m.id), [40, 42, 43, 44]);
  assert.equal(assignment.totalBoards, 2);
  assert.equal(assignment.isKnockoutOnly, true);
  assert.equal(assignment.primaryGroup.id, 0);
});

test("knockout-only fallback assigns the nth match in each round and active-round board count", () => {
  const assignment = getScorerBoardAssignment(
    {},
    [],
    [
      match(50, "KNOCKOUT", { roundKey: "QF", order: 1, status: "COMPLETED" }),
      match(51, "KNOCKOUT", { roundKey: "QF", order: 2, status: "IN_PROGRESS" }),
      match(52, "KNOCKOUT", { roundKey: "SF", order: 3, status: "PENDING" }),
    ],
    2,
  );
  assert.deepEqual(assignment.knockoutMatches.map(m => m.id), [51]);
  assert.equal(assignment.totalBoards, 2);
});

test("assertion rejects a match outside the assignment", () => {
  const assignment = getScorerBoardAssignment({}, [group(1)], [match(60, "GROUP", { groupId: 1 })], 1);
  assert.doesNotThrow(() => assertScorerMatchAssignedToBoard(60, assignment));
  assert.throws(
    () => assertScorerMatchAssignedToBoard(61, assignment),
    (error: unknown) => error instanceof ScorerBoardAuthorizationError,
  );
  assert.throws(
    () => getScorerBoardAssignment({}, [group(1)], [], 2),
    (error: unknown) => error instanceof ScorerBoardAuthorizationError,
  );
});