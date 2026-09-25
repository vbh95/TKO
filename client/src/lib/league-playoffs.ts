export type MembershipFilter = "all" | "member" | "non-member";
export type QualificationFilter = "all" | "automatic" | "not-automatic";
export type WinnerFilter = "all" | "won" | "not-won";
export type PlayoffSortField =
  | "position"
  | "points"
  | "attendancePercentage"
  | "tournamentsAttended"
  | "tournamentWins"
  | "threeDartAverage"
  | "bestTournamentAverage"
  | "first9Average"
  | "highestCheckout"
  | "bestLeg"
  | "oneEighties"
  | "matchWinPercentage"
  | "legWinPercentage";
export type SortDirection = "asc" | "desc";

export const playoffQueryKey = (userId: number | undefined, leagueId: number) =>
  ["/api/leagues/:id/playoffs", userId, leagueId] as const;

// League settings, tournament results, and manual standings can change on other
// pages. The app-wide cache otherwise treats responses as fresh indefinitely.
export const PLAYOFF_QUERY_REFRESH = {
  refetchOnMount: "always",
  refetchOnWindowFocus: "always",
} as const;

export type PlayoffPlayer = {
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

export type PlayoffFilters = {
  search: string;
  minAttendance: number;
  membership: MembershipFilter;
  qualification: QualificationFilter;
  minTournaments: number;
  winner: WinnerFilter;
  sort: PlayoffSortField;
  direction: SortDirection;
};

export const PLAYOFF_SORT_FIELDS: Array<{ value: PlayoffSortField; label: string }> = [
  { value: "position", label: "League position" },
  { value: "points", label: "Points" },
  { value: "attendancePercentage", label: "Attendance" },
  { value: "tournamentsAttended", label: "Tournaments attended" },
  { value: "tournamentWins", label: "Tournament wins" },
  { value: "threeDartAverage", label: "Overall 3-dart average" },
  { value: "bestTournamentAverage", label: "Best tournament 3-dart average" },
  { value: "first9Average", label: "First 9 average" },
  { value: "highestCheckout", label: "Highest checkout" },
  { value: "bestLeg", label: "Best leg (darts)" },
  { value: "oneEighties", label: "Most 180s" },
  { value: "matchWinPercentage", label: "Match win percentage" },
  { value: "legWinPercentage", label: "Leg win percentage" },
];

export const DEFAULT_SORT_DIRECTIONS: Record<PlayoffSortField, SortDirection> = {
  position: "asc",
  points: "desc",
  attendancePercentage: "desc",
  tournamentsAttended: "desc",
  tournamentWins: "desc",
  threeDartAverage: "desc",
  bestTournamentAverage: "desc",
  first9Average: "desc",
  highestCheckout: "desc",
  bestLeg: "asc",
  oneEighties: "desc",
  matchWinPercentage: "desc",
  legWinPercentage: "desc",
};

const sortFields = new Set<string>(PLAYOFF_SORT_FIELDS.map(field => field.value));

export function defaultPlayoffFilters(hasAutomaticPlaces: boolean): PlayoffFilters {
  return {
    search: "",
    minAttendance: 0,
    membership: "all",
    qualification: hasAutomaticPlaces ? "not-automatic" : "all",
    minTournaments: 0,
    winner: "all",
    sort: "position",
    direction: "asc",
  };
}

export function readPlayoffFilters(search: string, hasAutomaticPlaces: boolean): PlayoffFilters {
  const params = new URLSearchParams(search);
  const defaults = defaultPlayoffFilters(hasAutomaticPlaces);
  const attendance = Number(params.get("attendance"));
  const minTournaments = Number(params.get("tournaments"));
  const sort = params.get("sort");
  const membership = params.get("membership");
  const qualification = params.get("qualification");
  const winner = params.get("winner");
  const direction = params.get("direction");

  return {
    search: params.get("q") ?? defaults.search,
    minAttendance: Number.isInteger(attendance) && attendance >= 0 && attendance <= 100 && attendance % 10 === 0
      ? attendance : defaults.minAttendance,
    membership: membership === "member" || membership === "non-member" ? membership : defaults.membership,
    qualification: qualification === "automatic" || qualification === "not-automatic" || qualification === "all"
      ? qualification : defaults.qualification,
    minTournaments: Number.isInteger(minTournaments) && minTournaments >= 0 ? minTournaments : defaults.minTournaments,
    winner: winner === "won" || winner === "not-won" ? winner : defaults.winner,
    sort: sort && sortFields.has(sort) ? sort as PlayoffSortField : defaults.sort,
    direction: direction === "asc" || direction === "desc"
      ? direction : sort && sortFields.has(sort) ? DEFAULT_SORT_DIRECTIONS[sort as PlayoffSortField] : defaults.direction,
  };
}

export function serializePlayoffFilters(filters: PlayoffFilters): string {
  const params = new URLSearchParams();
  params.set("q", filters.search);
  params.set("attendance", String(filters.minAttendance));
  params.set("membership", filters.membership);
  params.set("qualification", filters.qualification);
  params.set("tournaments", String(filters.minTournaments));
  params.set("winner", filters.winner);
  params.set("sort", filters.sort);
  params.set("direction", filters.direction);
  return params.toString();
}

export function filterAndSortPlayers(
  players: PlayoffPlayer[],
  filters: PlayoffFilters,
): PlayoffPlayer[] {
  const search = filters.search.trim().toLocaleLowerCase();
  const filtered = players.filter(player => {
    if (search && !player.name.toLocaleLowerCase().includes(search)) return false;
    if (filters.minAttendance > 0 &&
      (player.attendancePercentage === null || player.attendancePercentage < filters.minAttendance)) return false;
    if (filters.membership !== "all" && player.membership !== filters.membership) return false;
    if (filters.qualification === "automatic" && player.qualification !== "automatic") return false;
    if (filters.qualification === "not-automatic" && player.qualification !== "not-automatic") return false;
    if (filters.minTournaments > 0 &&
      (player.tournamentsAttended === null || player.tournamentsAttended < filters.minTournaments)) return false;
    if (filters.winner === "won" &&
      (player.tournamentWins === null || player.tournamentWins <= 0)) return false;
    if (filters.winner === "not-won" &&
      (player.tournamentWins === null || player.tournamentWins !== 0)) return false;
    return true;
  });

  return filtered.sort((a, b) => {
    const aValue = a[filters.sort];
    const bValue = b[filters.sort];
    const aKnown = typeof aValue === "number" && Number.isFinite(aValue);
    const bKnown = typeof bValue === "number" && Number.isFinite(bValue);
    if (!aKnown || !bKnown) {
      if (aKnown !== bKnown) return aKnown ? -1 : 1;
      return a.position - b.position || a.name.localeCompare(b.name);
    }
    const result = (aValue as number) - (bValue as number);
    if (result !== 0) return filters.direction === "asc" ? result : -result;
    return a.position - b.position || a.name.localeCompare(b.name);
  });
}

export function safePlayoffsReturnPath(value: string | null | undefined, leagueId: number): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) {
    return null;
  }
  try {
    const url = new URL(value, "https://local.invalid");
    if (url.origin !== "https://local.invalid" || url.pathname !== `/leagues/${leagueId}/playoffs` ||
      url.hash || url.username || url.password) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}