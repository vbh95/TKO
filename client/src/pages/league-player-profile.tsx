import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { format } from "date-fns";
import { ArrowLeft, CalendarDays, Loader2, Trophy } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { LayoutShell } from "@/components/layout-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUser } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

type RecordInfo<T = number> = {
  value: T;
  tournament: string;
  round?: string;
  opponent?: string;
} | null;

type HistoryRow = {
  tournamentId: number;
  tournament: string;
  date: string | null;
  status: string;
  attended: boolean | null;
  finish: string | null;
  points: number | null;
  threeDartAverage: number | null;
  first9Average: number | null;
  bestLeg: number | null;
  highestCheckout: number | null;
  oneEighties: number | null;
};

type Profile = {
  league: { id: number; userId: number; name: string; startDate: string | null; endDate: string | null };
  player: { id: number; name: string };
  membership: { isClubMember: boolean; membershipConfirmedAt: string | null };
  summary: {
    position: number | null; points: number; tournamentsEntered: number;
    tournamentsAttended: number; totalTournaments: number; completedTournaments: number;
    attendancePercentage: number | null; tournamentWins: number;
    unattributedManualResults: number; unattributedManualPoints: number;
  };
  stats: {
    finishes: { runnerUp: number; semiFinal: number; quarterFinal: number; roundOf16: number; groupStage: number };
    matches: { played: number; won: number; lost: number | null; winPercentage: number | null };
    legs: { won: number | null; lost: number | null; difference: number | null; winPercentage: number | null };
    scoring: {
      threeDartAverage: number | null; first9Average: number | null;
      visits100Plus: number | null; visits140Plus: number | null; oneEighties: number | null;
    };
    finishing: { checkoutPercentage: number | null; highestCheckout: number | null };
    records: {
      bestLeg: RecordInfo; highestVisit: RecordInfo; bestMatchAverage: RecordInfo;
      bestTournamentAverage: RecordInfo; bestFinish: RecordInfo<string>;
      most180sTournament: RecordInfo; highestCheckout: RecordInfo;
      longestMatchWinningStreak: RecordInfo;
    };
  };
  history: HistoryRow[];
};

const value = (n: number | string | null | undefined, decimals?: number) =>
  n === null || n === undefined ? "—" : typeof n === "number" && decimals !== undefined ? n.toFixed(decimals) : String(n);
const percent = (n: number | null) => n === null ? "—" : `${value(n)}%`;
const date = (s: string | null) => {
  if (!s) return "—";
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? "—" : format(parsed, "dd/MM/yyyy");
};

function StatCard({ title, items }: { title: string; items: Array<[string, string]> }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {items.map(([label, content]) => (
          <div key={label} className="flex items-start justify-between gap-3 text-sm border-b border-border/50 last:border-0 pb-2 last:pb-0">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-semibold tabular-nums text-right">{content}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function BestCard({ title, record, decimals, suffix = "" }: {
  title: string; record: RecordInfo<string | number>; decimals?: number; suffix?: string;
}) {
  return (
    <Card className="min-w-0">
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
        <p className="text-xl font-bold tabular-nums mt-1 text-primary">
          {record ? `${value(record.value, decimals)}${suffix}` : "—"}
        </p>
        {record && (
          <p className="text-xs text-muted-foreground mt-1 break-words">
            {record.tournament}{record.round ? ` · ${record.round}` : ""}{record.opponent ? ` · vs ${record.opponent}` : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Trend({ history }: { history: HistoryRow[] }) {
  const points = history.filter(h => h.attended && (h.threeDartAverage !== null || h.first9Average !== null));
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle>Performance Trend</CardTitle></CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">No recorded averages yet.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mb-3">
              <span><span className="inline-block w-2.5 h-2.5 bg-green-500 rounded-full mr-1" />3-Dart Average</span>
              <span><span className="inline-block w-2.5 h-2.5 bg-lime-400 rounded-full mr-1" />First 9 Average</span>
            </div>
            <ChartContainer
              config={{
                threeDartAverage: { label: "3-Dart Average", color: "#22c55e" },
                first9Average: { label: "First 9 Average", color: "#a3e635" },
              }}
              className="h-64 w-full aspect-auto"
              role="img"
              aria-label="3-Dart and First 9 averages by league tournament"
            >
              <LineChart data={points} margin={{ top: 10, right: 12, bottom: 15, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="tournament" tick={{ fontSize: 11 }} interval="preserveStartEnd" tickLine={false} axisLine={false} />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <ChartTooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload as HistoryRow;
                  return (
                    <div className="rounded-lg border bg-background p-3 text-xs shadow-lg space-y-1">
                      <p className="font-semibold text-sm">{row.tournament}</p>
                      <p>3-Dart Average: {value(row.threeDartAverage, 2)}</p>
                      <p>First 9 Average: {value(row.first9Average, 2)}</p>
                      <p>Best leg: {value(row.bestLeg)}{row.bestLeg !== null ? " darts" : ""}</p>
                      <p>Highest checkout: {value(row.highestCheckout)}</p>
                    </div>
                  );
                }} />
                <Line type="monotone" dataKey="threeDartAverage" stroke="var(--color-threeDartAverage)" strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
                <Line type="monotone" dataKey="first9Average" stroke="var(--color-first9Average)" strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
              </LineChart>
            </ChartContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function LeaguePlayerProfile() {
  const [, params] = useRoute("/leagues/:id/players/:playerId/profile");
  const leagueId = Number(params?.id);
  const playerId = Number(params?.playerId);
  const { data: currentUser } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ["/api/leagues/:id/players/:playerId/profile", currentUser?.id, leagueId, playerId];
  const url = `/api/leagues/${leagueId}/players/${playerId}/profile`;
  const { data, isLoading, error } = useQuery<Profile>({
    queryKey,
    enabled: !!currentUser?.id && Number.isSafeInteger(leagueId) && leagueId > 0 &&
      Number.isSafeInteger(playerId) && playerId > 0,
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(res.status === 403 ? "Only the league creator can view this profile." :
        res.status === 404 ? "Player profile not found in this league." : "Could not load player profile.");
      return res.json();
    },
    retry: false,
  });
  const updateMembership = useMutation({
    mutationFn: async (isClubMember: boolean): Promise<Profile["membership"]> => {
      const res = await fetch(`${url}/membership`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ isClubMember }),
      });
      if (!res.ok) throw new Error("Could not update club membership.");
      return res.json();
    },
    onSuccess: membership => {
      queryClient.setQueryData<Profile>(queryKey, old => old ? { ...old, membership } : old);
      toast({ title: "Club membership updated" });
    },
    onError: () => toast({ title: "Membership was not changed", variant: "destructive" }),
  });

  if (isLoading) return <LayoutShell><div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></LayoutShell>;
  if (error || !data) return (
    <LayoutShell>
      <Card><CardContent className="py-12 text-center space-y-4">
        <p>{error instanceof Error ? error.message : "Player profile not found."}</p>
        <Link href={`/leagues/${leagueId}`} className="text-primary hover:underline">Back to league</Link>
      </CardContent></Card>
    </LayoutShell>
  );

  const { league, player, membership, summary, stats, history } = data;
  const isOwner = currentUser?.id === league.userId;
  if (!isOwner) return (
    <LayoutShell><Card><CardContent className="py-12 text-center">Only the league creator can view this profile.</CardContent></Card></LayoutShell>
  );
  const headline = [
    ["League position", summary.position === null ? "—" : `#${summary.position}`],
    ["League points", value(summary.points)],
    ["Tournaments attended", `${summary.tournamentsAttended} / ${summary.completedTournaments}`],
    ["Attendance", percent(summary.attendancePercentage)],
    ["Tournament wins", value(summary.tournamentWins)],
  ];

  return (
    <LayoutShell>
      <div className="space-y-6 pb-10">
        <div className="flex items-start gap-3">
          <Link href={`/leagues/${league.id}`}><Button variant="ghost" size="icon" aria-label="Back to league"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{league.name} / Player Profile</p>
            <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight break-words">{player.name}</h1>
            {(league.startDate || league.endDate) && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                <CalendarDays className="w-4 h-4" />{date(league.startDate)} — {date(league.endDate)}
              </p>
            )}
          </div>
          <Badge className={membership.isClubMember ? "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30" : "bg-muted text-muted-foreground"} variant="outline">
            {membership.isClubMember ? "✓ CLUB MEMBER" : "NOT A CLUB MEMBER"}
          </Badge>
        </div>

        {isOwner && (
          <Card>
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <label htmlFor="club-membership" className="font-medium text-sm cursor-pointer">Sports &amp; Social Club Member</label>
                <p className="text-xs text-muted-foreground mt-1">
                  Membership confirmed: {date(membership.membershipConfirmedAt)}
                </p>
              </div>
              <Checkbox id="club-membership" aria-label="Sports and Social Club Member" checked={membership.isClubMember}
                disabled={updateMembership.isPending}
                onCheckedChange={checked => { if (typeof checked === "boolean") updateMembership.mutate(checked); }} />
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {headline.map(([label, stat]) => (
            <Card key={label}><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl md:text-2xl font-bold tabular-nums mt-1">{stat}</p>
            </CardContent></Card>
          ))}
        </div>

        <section aria-label="Season statistics">
          <h2 className="text-xl font-display font-semibold mb-3">Season Summary</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <StatCard title="League" items={[
              ["Position", summary.position === null ? "—" : `#${summary.position}`],
              ["Points", value(summary.points)], ["Tournaments entered", value(summary.tournamentsEntered)],
              ["Total tournaments in league", value(summary.totalTournaments)],
              ["Attendance", percent(summary.attendancePercentage)],
              ["Tournament wins", value(summary.tournamentWins)],
              ["Runner-up finishes", value(stats.finishes.runnerUp)],
              ["Semi-final finishes", value(stats.finishes.semiFinal)],
              ["Quarter-final finishes", value(stats.finishes.quarterFinal)],
              ["R16 finishes", value(stats.finishes.roundOf16)],
              ["Group-stage exits", value(stats.finishes.groupStage)],
            ]} />
            <StatCard title="Matches" items={[
              ["Played", value(stats.matches.played)], ["Won", value(stats.matches.won)],
              ["Lost", value(stats.matches.lost)], ["Win %", percent(stats.matches.winPercentage)],
            ]} />
            <StatCard title="Legs" items={[
              ["Won", value(stats.legs.won)], ["Lost", value(stats.legs.lost)],
              ["Difference", value(stats.legs.difference)], ["Win %", percent(stats.legs.winPercentage)],
            ]} />
            <StatCard title="Scoring" items={[
              ["3-Dart Average", value(stats.scoring.threeDartAverage, 2)],
              ["First 9 Average", value(stats.scoring.first9Average, 2)],
              ["100+ visits", value(stats.scoring.visits100Plus)],
              ["140+ visits", value(stats.scoring.visits140Plus)],
              ["180s", value(stats.scoring.oneEighties)],
            ]} />
            <StatCard title="Finishing" items={[
              ["Checkout %", percent(stats.finishing.checkoutPercentage)],
              ["Highest checkout", value(stats.finishing.highestCheckout)],
            ]} />
          </div>
        </section>

        <Trend history={history} />

        <section>
          <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
            <h2 className="text-xl font-display font-semibold">Season Timeline</h2>
            <p className="text-sm text-muted-foreground">{summary.tournamentsAttended} / {summary.completedTournaments} completed tournaments attended · {percent(summary.attendancePercentage)}</p>
          </div>
          {history.length ? (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {history.map(h => (
                <div key={h.tournamentId} className="shrink-0 w-36 rounded-lg border bg-card p-3">
                  <p className="font-medium text-sm truncate" title={h.tournament}>{h.tournament}</p>
                  <p className="text-lg font-bold text-primary mt-2">{h.finish ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{h.attended === true ? "✓ Attended" : h.attended === false ? "Not attended" : "Not confirmed"}</p>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No league tournaments yet.</p>}
        </section>

        <section>
          <h2 className="text-xl font-display font-semibold mb-3">Tournament History</h2>
          {summary.unattributedManualResults > 0 && (
            <p className="text-sm text-muted-foreground mb-3">
              {summary.unattributedManualResults} manual result{summary.unattributedManualResults === 1 ? "" : "s"} worth{" "}
              {value(summary.unattributedManualPoints)} point{summary.unattributedManualPoints === 1 ? "" : "s"} are included in league totals,
              but cannot be assigned to one tournament in this history.
            </p>
          )}
          <Card>
            <CardContent className="p-0">
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    {["Tournament", "Date", "Attended", "Finish", "Points", "3-Dart Avg", "First 9", "Best leg", "Highest checkout", "180s"].map(h =>
                      <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>)}
                  </TableRow></TableHeader>
                  <TableBody>
                    {history.map(h => <TableRow key={h.tournamentId}>
                      <TableCell className="font-medium whitespace-nowrap">{h.tournament}</TableCell>
                      <TableCell className="whitespace-nowrap">{date(h.date)}</TableCell>
                      <TableCell className="whitespace-nowrap">{h.attended === null ? "—" : h.attended ? "Yes" : "No"}</TableCell>
                      <TableCell className="whitespace-nowrap">{h.finish ?? "—"}</TableCell>
                      <TableCell>{value(h.points)}</TableCell>
                      <TableCell>{value(h.threeDartAverage, 2)}</TableCell>
                      <TableCell>{value(h.first9Average, 2)}</TableCell>
                      <TableCell>{value(h.bestLeg)}</TableCell>
                      <TableCell>{value(h.highestCheckout)}</TableCell>
                      <TableCell>{value(h.oneEighties)}</TableCell>
                    </TableRow>)}
                  </TableBody>
                </Table>
              </div>
              <div className="md:hidden divide-y">
                {history.map(h => <div key={h.tournamentId} className="p-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-2"><strong>{h.tournament}</strong><span className="text-muted-foreground">{date(h.date)}</span></div>
                  <p className="text-muted-foreground">{h.attended === null ? "Not confirmed" : h.attended ? "Attended" : "Not attended"} · {h.finish ?? "—"}</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <span>Points: {value(h.points)}</span><span>3-Dart: {value(h.threeDartAverage, 2)}</span>
                    <span>First 9: {value(h.first9Average, 2)}</span><span>Best leg: {value(h.bestLeg)}</span>
                    <span>Checkout: {value(h.highestCheckout)}</span><span>180s: {value(h.oneEighties)}</span>
                  </div>
                </div>)}
              </div>
              {!history.length && <p className="p-6 text-sm text-muted-foreground">No tournaments to show.</p>}
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="text-xl font-display font-semibold mb-3 flex items-center gap-2"><Trophy className="w-5 h-5 text-primary" /> Season Bests</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            <BestCard title="Best tournament finish" record={stats.records.bestFinish} />
            <BestCard title="Best leg" record={stats.records.bestLeg} suffix=" darts" />
            <BestCard title="Highest checkout" record={stats.records.highestCheckout} />
            <BestCard title="Highest visit" record={stats.records.highestVisit} />
            <BestCard title="Most 180s in one tournament" record={stats.records.most180sTournament} />
            <BestCard title="Best match average" record={stats.records.bestMatchAverage} decimals={2} />
            <BestCard title="Best tournament average" record={stats.records.bestTournamentAverage} decimals={2} />
            <BestCard title="Longest winning streak" record={stats.records.longestMatchWinningStreak} />
          </div>
        </section>
      </div>
    </LayoutShell>
  );
}