import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import {
  ArrowDownUp,
  ArrowLeft,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { LayoutShell } from "@/components/layout-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-auth";
import {
  DEFAULT_SORT_DIRECTIONS,
  PLAYOFF_QUERY_REFRESH,
  PLAYOFF_SORT_FIELDS,
  defaultPlayoffFilters,
  filterAndSortPlayers,
  playoffQueryKey,
  readPlayoffFilters,
  serializePlayoffFilters,
  type PlayoffFilters,
  type PlayoffPlayer,
  type PlayoffSortField,
  type SortDirection,
} from "@/lib/league-playoffs";

type PlayoffsData = {
  league: { id: number; userId: number; name: string; promotionCount: number | null };
  totalTournaments: number;
  players: PlayoffPlayer[];
  selectedIdentities: string[];
};

type SelectionRequest = { identity: string; method: "POST" | "DELETE" };

const numberValue = (value: number | null, decimals = 0, suffix = "") =>
  value === null || !Number.isFinite(value) ? "—" : `${decimals ? value.toFixed(decimals) : value}${suffix}`;

const qualificationLabel = (qualification: PlayoffPlayer["qualification"]) => {
  if (qualification === "automatic") return "Automatically qualified";
  if (qualification === "not-automatic") return "Not automatically qualified";
  return "Not configured";
};

function writeFiltersToAddress(filters: PlayoffFilters) {
  const query = serializePlayoffFilters(filters);
  window.history.replaceState(window.history.state, "", `${window.location.pathname}?${query}`);
}

export default function LeaguePlayoffs() {
  const [, params] = useRoute("/leagues/:id/playoffs");
  const leagueId = Number(params?.id);
  const { data: currentUser } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = playoffQueryKey(currentUser?.id, leagueId);
  const [filters, setFilters] = useState<PlayoffFilters>(() =>
    readPlayoffFilters(typeof window === "undefined" ? "" : window.location.search, false),
  );
  const [pendingIdentity, setPendingIdentity] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery<PlayoffsData>({
    queryKey,
    ...PLAYOFF_QUERY_REFRESH,
    queryFn: async () => {
      const response = await fetch(`/api/leagues/${leagueId}/playoffs`, { credentials: "include" });
      if (!response.ok) {
        throw new Error(response.status === 403
          ? "Only the league creator can review the playoff field."
          : response.status === 404 ? "League not found." : "Could not load the playoff workspace.");
      }
      return response.json();
    },
    enabled: !!currentUser?.id && Number.isSafeInteger(leagueId) && leagueId > 0,
    retry: false,
  });

  const hasAutomaticPlaces = (data?.league.promotionCount ?? 0) > 0;

  useEffect(() => {
    if (!data) return;
    const parsed = readPlayoffFilters(window.location.search, hasAutomaticPlaces);
    parsed.minTournaments = Math.min(parsed.minTournaments, data.totalTournaments);
    setFilters(parsed);
    writeFiltersToAddress(parsed);
  }, [data?.league.id, data?.league.promotionCount, data?.totalTournaments]);

  useEffect(() => {
    const restoreFromAddress = () => {
      const next = readPlayoffFilters(window.location.search, hasAutomaticPlaces);
      if (data) next.minTournaments = Math.min(next.minTournaments, data.totalTournaments);
      setFilters(next);
    };
    window.addEventListener("popstate", restoreFromAddress);
    return () => window.removeEventListener("popstate", restoreFromAddress);
  }, [data, hasAutomaticPlaces]);

  const selectionMutation = useMutation({
    mutationFn: async ({ identity, method }: SelectionRequest) => {
      setPendingIdentity(identity);
      const response = await fetch(`/api/leagues/${leagueId}/playoffs/selection`, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identity }),
      });
      if (!response.ok) {
        let message = "Could not update the playoff field.";
        try {
          const body = await response.json();
          if (typeof body?.message === "string") message = body.message;
        } catch {
          // Keep the explicit request failure message.
        }
        throw new Error(message);
      }
      return response.json() as Promise<{ success: true }>;
    },
    onSuccess: (_result, variables) => {
      toast({
        title: variables.method === "POST" ? "Player added to playoff field" : "Player removed from playoff field",
      });
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (mutationError) => {
      toast({
        title: mutationError instanceof Error ? mutationError.message : "Could not update the playoff field.",
        variant: "destructive",
      });
    },
    onSettled: () => setPendingIdentity(null),
  });

  const commitFilters = (next: PlayoffFilters) => {
    setFilters(next);
    writeFiltersToAddress(next);
  };

  const resetFilters = () => {
    commitFilters(defaultPlayoffFilters(hasAutomaticPlaces));
  };

  const visiblePlayers = useMemo(
    () => data ? filterAndSortPlayers(data.players, filters) : [],
    [data?.players, filters],
  );
  const selectedIdentities = new Set(data?.selectedIdentities ?? []);
  const selectedPlayers = data?.players.filter(player => selectedIdentities.has(player.identity))
    .sort((a, b) => a.position - b.position) ?? [];
  const profileReturnTo = `${window.location.pathname}${window.location.search}`;

  const sortBy = (field: PlayoffSortField) => {
    const direction: SortDirection = filters.sort === field
      ? filters.direction === "asc" ? "desc" : "asc"
      : DEFAULT_SORT_DIRECTIONS[field];
    commitFilters({ ...filters, sort: field, direction });
  };

  const changeSort = (field: PlayoffSortField) => {
    commitFilters({
      ...filters,
      sort: field,
      direction: field === filters.sort ? filters.direction : DEFAULT_SORT_DIRECTIONS[field],
    });
  };

  const changeDirection = () => {
    commitFilters({ ...filters, direction: filters.direction === "asc" ? "desc" : "asc" });
  };

  if (isLoading || !currentUser?.id) {
    return <LayoutShell><div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></LayoutShell>;
  }

  if (error || !data) {
    return (
      <LayoutShell>
        <div className="mx-auto max-w-3xl py-12">
          <Card><CardContent className="space-y-4 py-10 text-center">
            <p className="text-muted-foreground">{error instanceof Error ? error.message : "Could not load the playoff workspace."}</p>
            <Link href={`/leagues/${leagueId}`}><Button variant="outline">Back to league</Button></Link>
          </CardContent></Card>
        </div>
      </LayoutShell>
    );
  }

  if (currentUser.id !== data.league.userId) {
    return (
      <LayoutShell>
        <div className="mx-auto max-w-3xl py-12">
          <Card><CardContent className="space-y-4 py-10 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">Only the league creator can review the playoff field.</p>
            <Link href={`/leagues/${leagueId}`}><Button variant="outline">Back to league</Button></Link>
          </CardContent></Card>
        </div>
      </LayoutShell>
    );
  }

  const promotionCount = data.league.promotionCount;
  const automaticCount = promotionCount && promotionCount > 0 ? promotionCount : null;
  const remainingCount = automaticCount === null ? null : Math.max(0, data.players.length - automaticCount);
  const totalTournaments = Math.max(0, data.totalTournaments);

  const renderSortHeading = (label: string, field: PlayoffSortField) => (
    <TableHead className="whitespace-nowrap"
      aria-sort={filters.sort === field ? filters.direction === "asc" ? "ascending" : "descending" : "none"}>
      <button
        type="button"
        className="font-medium hover:text-foreground"
        onClick={() => sortBy(field)}
        aria-label={`Sort by ${label}`}
      >
        {label}{filters.sort === field ? filters.direction === "asc" ? " ↑" : " ↓" : ""}
      </button>
    </TableHead>
  );

  const renderPlayerRow = (player: PlayoffPlayer) => {
    const inField = selectedIdentities.has(player.identity);
    const busy = pendingIdentity === player.identity && selectionMutation.isPending;
    const profileHref = player.profilePlayerId === null ? null
      : `/leagues/${leagueId}/players/${player.profilePlayerId}/profile?returnTo=${encodeURIComponent(profileReturnTo)}`;
    return (
      <TableRow key={player.identity} data-testid={`row-playoff-player-${player.position}`}>
        <TableCell className="text-center font-semibold tabular-nums">{player.position}</TableCell>
        <TableCell className="min-w-48">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium">{player.name}</span>
            {profileHref && <Link href={profileHref} className="whitespace-nowrap text-xs text-primary hover:underline">View Profile</Link>}
          </div>
        </TableCell>
        <TableCell className="text-center tabular-nums">{player.points}</TableCell>
        <TableCell className="whitespace-nowrap">{qualificationLabel(player.qualification)}</TableCell>
        <TableCell className="whitespace-nowrap tabular-nums">{numberValue(player.attendancePercentage, 0, player.attendancePercentage === null ? "" : "%")}</TableCell>
        <TableCell className="text-center tabular-nums">
          {player.tournamentsAttended === null ? "—" : `${player.tournamentsAttended}/${player.totalTournaments}`}
        </TableCell>
        <TableCell className="text-center tabular-nums">{numberValue(player.tournamentWins)}</TableCell>
        <TableCell className="text-center tabular-nums">{numberValue(player.runnerUp)}</TableCell>
        <TableCell className="text-center tabular-nums">{numberValue(player.threeDartAverage, 2)}</TableCell>
        <TableCell className="text-center tabular-nums">{numberValue(player.bestTournamentAverage, 2)}</TableCell>
        <TableCell className="text-center tabular-nums">{numberValue(player.first9Average, 2)}</TableCell>
        <TableCell className="text-center tabular-nums">{numberValue(player.highestCheckout)}</TableCell>
        <TableCell className="text-center tabular-nums">{numberValue(player.bestLeg, 0, player.bestLeg === null ? "" : " darts")}</TableCell>
        <TableCell className="text-center tabular-nums">{numberValue(player.oneEighties)}</TableCell>
        <TableCell className="text-center tabular-nums">{numberValue(player.matchWinPercentage, 0, player.matchWinPercentage === null ? "" : "%")}</TableCell>
        <TableCell className="text-center tabular-nums">{numberValue(player.legWinPercentage, 0, player.legWinPercentage === null ? "" : "%")}</TableCell>
        <TableCell className="whitespace-nowrap">{player.membership === "unknown" ? "—" : player.membership === "member" ? "Member" : "Non-member"}</TableCell>
        <TableCell className="text-right">
          <Button
            type="button"
            size="sm"
            variant={inField ? "outline" : "default"}
            disabled={selectionMutation.isPending}
            onClick={() => selectionMutation.mutate({ identity: player.identity, method: inField ? "DELETE" : "POST" })}
            data-testid={`${inField ? "button-remove" : "button-add"}-playoff-player-${player.position}`}
          >
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : inField ? <X className="mr-1 h-4 w-4" /> : <Plus className="mr-1 h-4 w-4" />}
            {inField ? "Remove" : "Add"}
          </Button>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <LayoutShell>
      <div className="space-y-6 pb-10">
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/leagues/${leagueId}`}>
            <Button variant="ghost" size="icon" aria-label="Back to league"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{data.league.name} / Private workspace</p>
            <h1 className="text-2xl font-display font-bold tracking-tight md:text-3xl">PLAYOFFS</h1>
            <p className="mt-1 text-sm text-muted-foreground">Review and select players for Champions Night playoff places.</p>
          </div>
          <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
            <ShieldCheck className="h-3.5 w-3.5" /> Private workspace
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card><CardContent className="flex items-center gap-3 p-4">
            <Users className="h-5 w-5 text-primary" />
            <div><p className="text-xs text-muted-foreground">League players</p><p className="text-xl font-bold tabular-nums">{data.players.length}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4">
            <Trophy className="h-5 w-5 text-primary" />
            <div><p className="text-xs text-muted-foreground">Automatic places</p><p className="text-xl font-bold tabular-nums">{automaticCount === null ? "Not configured" : automaticCount}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div><p className="text-xs text-muted-foreground">Outside automatic places</p><p className="text-xl font-bold tabular-nums">{remainingCount === null ? "—" : remainingCount}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4">
            <Trophy className="h-5 w-5 text-primary" />
            <div><p className="text-xs text-muted-foreground">Selected playoff field</p><p className="text-xl font-bold tabular-nums">{data.selectedIdentities.length}</p></div>
          </CardContent></Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Playoff Field</CardTitle>
              <span className="text-sm text-muted-foreground">{selectedPlayers.length} current standings player{selectedPlayers.length === 1 ? "" : "s"}</span>
            </div>
          </CardHeader>
          <CardContent>
            {selectedPlayers.length ? (
              <ul className="divide-y">
                {selectedPlayers.map(player => (
                  <li key={player.identity} className="flex flex-wrap items-center gap-3 py-2 first:pt-0 last:pb-0">
                    <Badge variant="outline" className="tabular-nums">#{player.position}</Badge>
                    <span className="min-w-0 flex-1 font-medium">{player.name}</span>
                    <span className="text-sm tabular-nums text-muted-foreground">{player.points} points</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={selectionMutation.isPending}
                      onClick={() => selectionMutation.mutate({ identity: player.identity, method: "DELETE" })}
                      aria-label={`Remove ${player.name} from playoff field`}
                    >
                      {pendingIdentity === player.identity && selectionMutation.isPending
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <X className="h-4 w-4" />}
                      <span className="sr-only">Remove</span>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No players selected yet. Add candidates from the standings below.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">League players</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Review standings and reliable profile data; shortlist choices do not change qualification.</p>
              </div>
              <span className="text-sm text-muted-foreground" aria-live="polite">
                Showing {visiblePlayers.length} of {data.players.length}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <label htmlFor="playoffs-search" className="text-xs font-medium text-muted-foreground">Search player</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="playoffs-search" className="pl-9" placeholder="Player name" value={filters.search}
                    onChange={event => commitFilters({ ...filters, search: event.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <label htmlFor="playoffs-membership" className="text-xs font-medium text-muted-foreground">Club membership</label>
                <Select value={filters.membership} onValueChange={value =>
                  commitFilters({ ...filters, membership: value as PlayoffFilters["membership"] })}>
                  <SelectTrigger id="playoffs-membership" data-testid="select-playoffs-membership"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All membership states</SelectItem>
                    <SelectItem value="member">Members</SelectItem>
                    <SelectItem value="non-member">Non-members</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label htmlFor="playoffs-qualification" className="text-xs font-medium text-muted-foreground">Qualification status</label>
                <Select value={filters.qualification} onValueChange={value =>
                  commitFilters({ ...filters, qualification: value as PlayoffFilters["qualification"] })}>
                  <SelectTrigger id="playoffs-qualification" data-testid="select-playoffs-qualification"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All players</SelectItem>
                    <SelectItem value="automatic">Automatically qualified</SelectItem>
                    <SelectItem value="not-automatic">Not automatically qualified</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label htmlFor="playoffs-tournaments" className="text-xs font-medium text-muted-foreground">Minimum tournaments attended</label>
                <Select value={String(filters.minTournaments)} onValueChange={value =>
                  commitFilters({ ...filters, minTournaments: Number(value) })}>
                  <SelectTrigger id="playoffs-tournaments" data-testid="select-playoffs-tournaments"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: totalTournaments + 1 }, (_, count) => (
                      <SelectItem key={count} value={String(count)}>{count === 0 ? "Any number" : `${count} or more`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label htmlFor="playoffs-winner" className="text-xs font-medium text-muted-foreground">Tournament wins</label>
                <Select value={filters.winner} onValueChange={value =>
                  commitFilters({ ...filters, winner: value as PlayoffFilters["winner"] })}>
                  <SelectTrigger id="playoffs-winner" data-testid="select-playoffs-winner"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All win records</SelectItem>
                    <SelectItem value="won">Has tournament win</SelectItem>
                    <SelectItem value="not-won">No tournament wins</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label htmlFor="playoffs-attendance" className="flex justify-between text-xs font-medium text-muted-foreground">
                  <span>Minimum attendance</span><span>{filters.minAttendance}%</span>
                </label>
                <input
                  id="playoffs-attendance"
                  type="range"
                  min={0}
                  max={100}
                  step={10}
                  value={filters.minAttendance}
                  onChange={event => commitFilters({ ...filters, minAttendance: Number(event.target.value) })}
                  className="h-9 w-full accent-primary"
                  aria-label="Minimum attendance percentage"
                  data-testid="slider-playoffs-attendance"
                />
              </div>
              <div className="space-y-1 md:hidden">
                <label htmlFor="playoffs-sort-mobile" className="text-xs font-medium text-muted-foreground">Sort by</label>
                <div className="flex gap-2">
                  <Select value={filters.sort} onValueChange={value => changeSort(value as PlayoffSortField)}>
                    <SelectTrigger id="playoffs-sort-mobile" data-testid="select-playoffs-sort"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLAYOFF_SORT_FIELDS.map(field => <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="icon" onClick={changeDirection} aria-label={`Sort ${filters.direction === "asc" ? "descending" : "ascending"}`}>
                    <ArrowDownUp className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-end justify-end sm:col-span-2 lg:col-span-1">
                <Button type="button" variant="outline" size="sm" onClick={resetFilters} className="gap-2" data-testid="button-reset-playoffs-filters">
                  <RotateCcw className="h-4 w-4" />Reset Filters
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {renderSortHeading("Pos", "position")}
                    <TableHead className="whitespace-nowrap">Player</TableHead>
                    {renderSortHeading("Points", "points")}
                    <TableHead className="whitespace-nowrap">Qualification</TableHead>
                    {renderSortHeading("Attendance", "attendancePercentage")}
                    {renderSortHeading("Tournaments", "tournamentsAttended")}
                    {renderSortHeading("Wins", "tournamentWins")}
                    <TableHead className="whitespace-nowrap">Runner-up</TableHead>
                    {renderSortHeading("3-Dart Avg", "threeDartAverage")}
                    {renderSortHeading("Best Tournament Avg", "bestTournamentAverage")}
                    {renderSortHeading("First 9 Avg", "first9Average")}
                    {renderSortHeading("Highest Checkout", "highestCheckout")}
                    {renderSortHeading("Best Leg", "bestLeg")}
                    {renderSortHeading("180s", "oneEighties")}
                    {renderSortHeading("Match Win %", "matchWinPercentage")}
                    {renderSortHeading("Leg Win %", "legWinPercentage")}
                    <TableHead className="whitespace-nowrap">Membership</TableHead>
                    <TableHead className="text-right">Playoff field</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visiblePlayers.map(renderPlayerRow)}
                  {!visiblePlayers.length && (
                    <TableRow><TableCell colSpan={18} className="py-10 text-center text-muted-foreground">
                      {data.players.length ? "No players match these filters." : "No standings players yet."}
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </LayoutShell>
  );
}