/**
 * The authoritative board-to-match mapping used by scorer endpoints.
 *
 * This module intentionally has no database or HTTP dependencies.  Keeping the
 * mapping pure makes it possible for every scorer route (and its tests) to use
 * exactly the same board-rotation and reassignment rules.
 */

export interface ScorerBoardSettings {
  groupScheduleMode?: "standard" | "board_rotation" | string;
  numberOfBoards?: number | null;
  numBoards?: number | null;
}

export interface ScorerBoardGroup {
  id: number;
  name: string;
  [key: string]: unknown;
}

export interface ScorerBoardMatch {
  id: number;
  stage: string;
  roundKey: string;
  groupId?: number | null;
  boardNumber?: number | null;
  order: number;
  status?: string;
  [key: string]: unknown;
}

export class ScorerBoardAuthorizationError extends Error {
  readonly code = "BOARD_NOT_FOUND";

  constructor(message: string) {
    super(message);
    this.name = "ScorerBoardAuthorizationError";
  }
}

export interface ScorerBoardAssignment {
  boardNumber: number;
  primaryGroup: ScorerBoardGroup;
  /** Group matches assigned to this board, including its natural group. */
  groupMatches: ScorerBoardMatch[];
  /** Explicitly reassigned matches from another group assigned to this board. */
  guestGroupMatches: ScorerBoardMatch[];
  /** Primary-group matches explicitly assigned to a different board. */
  reassignedGroupMatches: ScorerBoardMatch[];
  knockoutMatches: ScorerBoardMatch[];
  /** All authoritative matches assigned to this board. */
  assignedMatches: ScorerBoardMatch[];
  assignedMatchIds: number[];
  totalBoards: number;
  isKnockoutOnly: boolean;
  isBoardRotation: boolean;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/**
 * Calculate the matches a scorer board may authoritatively operate on.
 *
 * `sortedGroups` must be in the same deterministic order used by the scorer
 * (Group A, Group B, ...).  The helper does not mutate either input array.
 */
export function getScorerBoardAssignment(
  settings: ScorerBoardSettings | null | undefined,
  sortedGroups: readonly ScorerBoardGroup[],
  allMatches: readonly ScorerBoardMatch[],
  boardNumber: number,
): ScorerBoardAssignment {
  if (!positiveInteger(boardNumber)) {
    throw new ScorerBoardAuthorizationError("Board number must be a positive integer");
  }

  const isKnockoutOnly = sortedGroups.length === 0;
  const isBoardRotation = !isKnockoutOnly && settings?.groupScheduleMode === "board_rotation";

  let primaryGroup: ScorerBoardGroup;
  if (isKnockoutOnly) {
    primaryGroup = { id: 0, name: `Board ${boardNumber}` };
  } else {
    const groupIndex = isBoardRotation ? (boardNumber - 1) * 2 : boardNumber - 1;
    const group = sortedGroups[groupIndex];
    if (!group) {
      throw new ScorerBoardAuthorizationError(`Board ${boardNumber} not found`);
    }
    primaryGroup = group;
  }

  let groupMatches: ScorerBoardMatch[] = [];
  let guestGroupMatches: ScorerBoardMatch[] = [];
  let reassignedGroupMatches: ScorerBoardMatch[] = [];

  if (isBoardRotation) {
    // Rotation schedules assign every group match explicitly to a board.
    groupMatches = allMatches.filter(
      match => match.stage === "GROUP" && match.boardNumber === boardNumber,
    );
  } else if (!isKnockoutOnly) {
    groupMatches = allMatches.filter(
      match =>
        match.groupId === primaryGroup.id
        && (match.boardNumber == null || match.boardNumber === boardNumber),
    );
    guestGroupMatches = allMatches.filter(
      match =>
        match.stage === "GROUP"
        && match.groupId !== primaryGroup.id
        && match.boardNumber === boardNumber,
    );
    reassignedGroupMatches = allMatches.filter(
      match =>
        match.stage === "GROUP"
        && match.groupId === primaryGroup.id
        && match.boardNumber != null
        && match.boardNumber !== boardNumber,
    );
  }

  const knockoutMatches: ScorerBoardMatch[] = [];
  if (isKnockoutOnly) {
    const sortedKnockout = allMatches
      .filter(match => match.stage === "KNOCKOUT")
      .slice()
      .sort((a, b) => a.order - b.order);
    const roundGroups = new Map<string, ScorerBoardMatch[]>();
    for (const match of sortedKnockout) {
      const round = roundGroups.get(match.roundKey);
      if (round) round.push(match);
      else roundGroups.set(match.roundKey, [match]);
    }

    const configuredBoards = positiveInteger(settings?.numBoards)
      ? settings!.numBoards!
      : undefined;
    if (configuredBoards) {
      roundGroups.forEach(roundMatches => {
        for (let index = 0; index < roundMatches.length; index++) {
          if ((index % configuredBoards) + 1 === boardNumber) {
            knockoutMatches.push(roundMatches[index]);
          }
        }
      });
    } else {
      roundGroups.forEach(roundMatches => {
        const match = roundMatches[boardNumber - 1];
        if (match) knockoutMatches.push(match);
      });
    }
  } else {
    // In mixed tournaments knockout matches already carry their authoritative
    // board assignment.  Do not apply knockout-only modular allocation here.
    knockoutMatches.push(
      ...allMatches.filter(
        match => match.stage === "KNOCKOUT" && match.boardNumber === boardNumber,
      ),
    );
  }

  const assignedMatches = [...groupMatches, ...guestGroupMatches, ...knockoutMatches];
  const assignedMatchIds = assignedMatches.map(match => match.id);
  const totalBoards = isKnockoutOnly
    ? (() => {
        const configuredBoards = positiveInteger(settings?.numBoards)
          ? settings!.numBoards!
          : undefined;
        if (configuredBoards) return configuredBoards;
        const rounds = new Map<string, ScorerBoardMatch[]>();
        allMatches
          .filter(candidate => candidate.stage === "KNOCKOUT")
          .slice()
          .sort((a, b) => a.order - b.order)
          .forEach(match => {
          const round = rounds.get(match.roundKey);
          if (round) round.push(match);
          else rounds.set(match.roundKey, [match]);
          });
        const roundList = Array.from(rounds.values());
        const currentRound = roundList.find(
          round => round.some(match => match.status !== "COMPLETED"),
        ) || roundList[0] || [];
        return currentRound.length || boardNumber;
      })()
    : isBoardRotation
      ? (positiveInteger(settings?.numberOfBoards)
        ? settings!.numberOfBoards!
        : Math.floor(sortedGroups.length / 2))
      : sortedGroups.length;

  return {
    boardNumber,
    primaryGroup,
    groupMatches,
    guestGroupMatches,
    reassignedGroupMatches,
    knockoutMatches,
    assignedMatches,
    assignedMatchIds,
    totalBoards,
    isKnockoutOnly,
    isBoardRotation,
  };
}

export function isScorerMatchAssignedToBoard(
  match: ScorerBoardMatch | number,
  assignment: ScorerBoardAssignment,
): boolean {
  const matchId = typeof match === "number" ? match : match.id;
  return assignment.assignedMatchIds.includes(matchId);
}

export function assertScorerMatchAssignedToBoard(
  match: ScorerBoardMatch | number,
  assignment: ScorerBoardAssignment,
): void {
  if (!isScorerMatchAssignedToBoard(match, assignment)) {
    throw new ScorerBoardAuthorizationError("Match is not assigned to this board");
  }
}