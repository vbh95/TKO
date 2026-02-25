import { useParams } from "wouter";
import { useEffect, useState, useRef, useCallback } from "react";
import { usePublicTournament } from "@/hooks/use-tournaments";
import { Loader2, Trophy, Eye, Sun, Moon, Check, ChevronDown, Crosshair } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import tkoLogoFull from "@assets/TKO_White-04_1771178906649.png";
import { useSocket } from "@/hooks/use-socket";
import { calcStandings } from "@/lib/standings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface LiveScoring {
  matchId: number;
  remainingA: number;
  remainingB: number;
  currentThrower: 'A' | 'B';
  legsWonA: number;
  legsWonB: number;
  playerAName: string;
  playerBName: string;
  bestOf: number;
  avgA: string;
  avgB: string;
  dartsA: number;
  dartsB: number;
  lastScoreA: number | null;
  lastScoreB: number | null;
}

function CompletedMatchRow({ match, playerA, playerB, shareToken, scorerName }: {
  match: any;
  playerA: any;
  playerB: any;
  shareToken: string;
  scorerName?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const isCompleted = match.status === 'COMPLETED';

  const handleClick = async () => {
    if (!isCompleted) return;
    const willExpand = !expanded;
    setExpanded(willExpand);
    if (willExpand && !fetched) {
      setLoading(true);
      try {
        const res = await fetch(`/api/public/t/${shareToken}/match/${match.id}/notes`);
        if (res.ok) {
          const data = await res.json();
          setNotes(data);
        }
      } catch { }
      setLoading(false);
      setFetched(true);
    }
  };

  const threeDartAvgA = notes?.totalVisitsA > 0 ? ((notes.totalScoredA / notes.totalVisitsA) * 3).toFixed(1) : '-';
  const threeDartAvgB = notes?.totalVisitsB > 0 ? ((notes.totalScoredB / notes.totalVisitsB) * 3).toFixed(1) : '-';
  const checkoutPctA = notes?.checkoutAttemptsA > 0 ? ((notes.checkoutSuccessA / notes.checkoutAttemptsA) * 100).toFixed(1) + '%' : '-';
  const checkoutPctB = notes?.checkoutAttemptsB > 0 ? ((notes.checkoutSuccessB / notes.checkoutAttemptsB) * 100).toFixed(1) + '%' : '-';

  const statRows = notes ? [
    { label: '3-Dart Avg', valA: threeDartAvgA, valB: threeDartAvgB },
    { label: 'Checkout %', valA: checkoutPctA, valB: checkoutPctB },
    { label: 'Highest Finish', valA: notes.highestFinishA || '-', valB: notes.highestFinishB || '-' },
    { label: 'Highest Visit', valA: notes.highestVisitA || '-', valB: notes.highestVisitB || '-' },
    { label: '180s', valA: notes.ton80sA ?? '-', valB: notes.ton80sB ?? '-' },
    { label: '140+', valA: notes.ton40sA ?? '-', valB: notes.ton40sB ?? '-' },
    { label: '100+', valA: notes.tonsA ?? '-', valB: notes.tonsB ?? '-' },
    { label: 'Darts Thrown', valA: notes.totalVisitsA != null ? notes.totalVisitsA * 3 : '-', valB: notes.totalVisitsB != null ? notes.totalVisitsB * 3 : '-' },
  ] : [];

  return (
    <div data-testid={`match-row-${match.id}`}>
      <div
        className={cn(
          "flex items-center justify-between p-4 transition-colors",
          isCompleted && "cursor-pointer hover:bg-muted/30"
        )}
        onClick={handleClick}
        data-testid={`button-match-stats-${match.id}`}
      >
        <div className="flex-1 text-right font-medium">
          <span className={cn(match.winnerId === match.playerAId && "text-green-600 dark:text-green-400 font-bold")}>
            {playerA?.name || "TBD"}
          </span>
        </div>

        <div className="flex items-center gap-3 px-6">
          <span className={cn(
            "text-xl font-bold",
            match.scoreA! > match.scoreB! ? "text-primary" : "text-muted-foreground"
          )}>
            {match.scoreA || 0}
          </span>
          <span className="text-muted-foreground text-xs uppercase font-medium">vs</span>
          <span className={cn(
            "text-xl font-bold",
            match.scoreB! > match.scoreA! ? "text-primary" : "text-muted-foreground"
          )}>
            {match.scoreB || 0}
          </span>
        </div>

        <div className="flex-1 text-left font-medium">
          <span className={cn(match.winnerId === match.playerBId && "text-green-600 dark:text-green-400 font-bold")}>
            {playerB?.name || "TBD"}
          </span>
        </div>

        {isCompleted && (
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform ml-2", expanded && "rotate-180")} />
        )}
      </div>

      {scorerName && (
        <div className="px-4 pb-1 text-[11px] text-muted-foreground text-center" data-testid={`public-match-scorer-${match.id}`}>
          Scorer: {scorerName}
        </div>
      )}

      {expanded && isCompleted && (
        <div className="border-t bg-muted/20 px-4 py-3">
          {loading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && notes && statRows.length > 0 && (
            <div className="max-w-md mx-auto">
              <div className="grid grid-cols-3 gap-1 text-sm">
                <div className="text-right font-bold text-xs text-muted-foreground pb-1">{playerA?.name}</div>
                <div className="text-center font-bold text-xs text-muted-foreground pb-1">Stat</div>
                <div className="text-left font-bold text-xs text-muted-foreground pb-1">{playerB?.name}</div>
                {statRows.map(({ label, valA, valB }) => {
                  const aNum = parseFloat(String(valA));
                  const bNum = parseFloat(String(valB));
                  const aWins = !isNaN(aNum) && !isNaN(bNum) && aNum > bNum;
                  const bWins = !isNaN(aNum) && !isNaN(bNum) && bNum > aNum;
                  return (
                    <div key={label} className="contents">
                      <div className={cn("text-right tabular-nums py-0.5", aWins && "text-green-600 dark:text-green-400 font-semibold")}>{valA}</div>
                      <div className="text-center text-muted-foreground text-xs py-0.5">{label}</div>
                      <div className={cn("text-left tabular-nums py-0.5", bWins && "text-green-600 dark:text-green-400 font-semibold")}>{valB}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {!loading && !notes && (
            <p className="text-sm text-muted-foreground text-center py-2">No detailed stats available for this match</p>
          )}
        </div>
      )}
    </div>
  );
}

function KnockoutMatchCard({ match, playerA, playerB, label, isCompleted, shareToken }: {
  match: any;
  playerA: any;
  playerB: any;
  label: string;
  isCompleted: boolean;
  shareToken: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const handleClick = async () => {
    if (!isCompleted) return;
    const willExpand = !expanded;
    setExpanded(willExpand);
    if (willExpand && !fetched) {
      setLoading(true);
      try {
        const res = await fetch(`/api/public/t/${shareToken}/match/${match.id}/notes`);
        if (res.ok) setNotes(await res.json());
      } catch { }
      setLoading(false);
      setFetched(true);
    }
  };

  const threeDartAvgA = notes?.totalVisitsA > 0 ? ((notes.totalScoredA / notes.totalVisitsA) * 3).toFixed(1) : '-';
  const threeDartAvgB = notes?.totalVisitsB > 0 ? ((notes.totalScoredB / notes.totalVisitsB) * 3).toFixed(1) : '-';
  const checkoutPctA = notes?.checkoutAttemptsA > 0 ? ((notes.checkoutSuccessA / notes.checkoutAttemptsA) * 100).toFixed(1) + '%' : '-';
  const checkoutPctB = notes?.checkoutAttemptsB > 0 ? ((notes.checkoutSuccessB / notes.checkoutAttemptsB) * 100).toFixed(1) + '%' : '-';
  const statRows = notes ? [
    { label: '3-Dart Avg', valA: threeDartAvgA, valB: threeDartAvgB },
    { label: 'Checkout %', valA: checkoutPctA, valB: checkoutPctB },
    { label: 'Highest Finish', valA: notes.highestFinishA || '-', valB: notes.highestFinishB || '-' },
    { label: 'Highest Visit', valA: notes.highestVisitA || '-', valB: notes.highestVisitB || '-' },
    { label: '180s', valA: notes.ton80sA ?? '-', valB: notes.ton80sB ?? '-' },
    { label: '140+', valA: notes.ton40sA ?? '-', valB: notes.ton40sB ?? '-' },
    { label: '100+', valA: notes.tonsA ?? '-', valB: notes.tonsB ?? '-' },
    { label: 'Darts Thrown', valA: notes.totalVisitsA != null ? notes.totalVisitsA * 3 : '-', valB: notes.totalVisitsB != null ? notes.totalVisitsB * 3 : '-' },
  ] : [];

  return (
    <Card
      className={cn(
        "overflow-hidden flex flex-col h-full",
        isCompleted ? "border border-muted-foreground/20 cursor-pointer" : "border-2 border-dashed border-primary/40"
      )}
      data-testid={`knockout-match-${match.id}`}
      onClick={handleClick}
      role={isCompleted ? "button" : undefined}
    >
      <CardHeader className={cn("border-b py-2.5 px-4", isCompleted ? "bg-muted/30" : "bg-primary/5")}>
        <CardTitle className="text-sm flex items-center gap-2">
          {isCompleted ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <span className="w-2.5 h-2.5 bg-amber-500 rounded-full" />
          )}
          {label}
          {!isCompleted && (
            <span className="text-xs text-muted-foreground ml-auto">Next Up</span>
          )}
          {isCompleted && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
              Tap for stats
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", expanded && "rotate-180")} />
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="py-4 px-4 flex-1 flex flex-col">
        {isCompleted ? (
          <div className="flex items-center justify-between text-center">
            <div className="flex-1">
              <p className={cn("text-lg font-bold", match.winnerId === match.playerAId && "text-green-600 dark:text-green-400")}>
                {playerA?.name || "TBD"}
              </p>
            </div>
            <div className="flex items-center gap-3 px-3">
              <span className={cn("text-2xl font-bold tabular-nums", match.winnerId === match.playerAId && "text-green-600 dark:text-green-400")}>{match.scoreA || 0}</span>
              <span className="text-muted-foreground text-xs uppercase font-medium">vs</span>
              <span className={cn("text-2xl font-bold tabular-nums", match.winnerId === match.playerBId && "text-green-600 dark:text-green-400")}>{match.scoreB || 0}</span>
            </div>
            <div className="flex-1">
              <p className={cn("text-lg font-bold", match.winnerId === match.playerBId && "text-green-600 dark:text-green-400")}>
                {playerB?.name || "TBD"}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center">
            <p className="text-xl font-bold">
              {playerA?.name || "TBD"}
              <span className="text-muted-foreground text-sm uppercase font-medium tracking-wider mx-3">vs</span>
              {playerB?.name || "TBD"}
            </p>
          </div>
        )}
        {match.scorerName && (
          <div className="pt-2 text-[11px] text-muted-foreground text-center" data-testid={`knockout-scorer-${match.id}`}>
            Scorer: {match.scorerName}
          </div>
        )}
      </CardContent>
      {expanded && isCompleted && (
        <div className="border-t bg-muted/20 px-4 py-3">
          {loading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && notes && statRows.length > 0 && (
            <div className="max-w-sm mx-auto">
              <div className="grid grid-cols-3 gap-1 text-sm">
                <div className="text-right font-bold text-xs text-muted-foreground pb-1">{playerA?.name}</div>
                <div className="text-center font-bold text-xs text-muted-foreground pb-1">Stat</div>
                <div className="text-left font-bold text-xs text-muted-foreground pb-1">{playerB?.name}</div>
                {statRows.map(({ label: sl, valA, valB }) => {
                  const aNum = parseFloat(String(valA));
                  const bNum = parseFloat(String(valB));
                  const aWins = !isNaN(aNum) && !isNaN(bNum) && aNum > bNum;
                  const bWins = !isNaN(aNum) && !isNaN(bNum) && bNum > aNum;
                  return (
                    <div key={sl} className="contents">
                      <div className={cn("text-right tabular-nums py-0.5", aWins && "text-green-600 dark:text-green-400 font-semibold")}>{valA}</div>
                      <div className="text-center text-muted-foreground text-xs py-0.5">{sl}</div>
                      <div className={cn("text-left tabular-nums py-0.5", bWins && "text-green-600 dark:text-green-400 font-semibold")}>{valB}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {!loading && !notes && (
            <p className="text-sm text-muted-foreground text-center py-2">No detailed stats available for this match</p>
          )}
        </div>
      )}
    </Card>
  );
}

function LiveMatchCard({ match, ls, playerA, playerB, headerLabel }: {
  match: any;
  ls: LiveScoring | undefined;
  playerA: any;
  playerB: any;
  headerLabel: string;
}) {
  return (
    <Card className="border-2 border-primary shadow-xl overflow-hidden" data-testid={`live-match-${match.id}`}>
      <CardHeader className="bg-primary/10 border-b py-2.5 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
          {headerLabel}
          {ls && (
            <span className="text-xs text-muted-foreground ml-auto">
              Leg {(ls.legsWonA + ls.legsWonB + 1)} / Best of {ls.bestOf}
            </span>
          )}
        </CardTitle>
        {ls && (
          <div className="flex items-center justify-between mt-2">
            <span className="truncate max-w-[38%] text-xl font-black">{ls.playerAName || playerA?.name || 'TBD'}</span>
            <span className="text-primary font-black font-mono shrink-0 px-3 text-2xl tabular-nums">{ls.legsWonA} — {ls.legsWonB}</span>
            <span className="truncate max-w-[38%] text-right text-xl font-black">{ls.playerBName || playerB?.name || 'TBD'}</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-3 pb-4 px-4">
        {ls ? (
          <div>
            <div className="grid grid-cols-2 gap-2">
              <div
                className={cn(
                  "rounded-lg p-3 transition-all",
                  ls.currentThrower === 'A'
                    ? "bg-red-600/15 ring-2 ring-red-500/50"
                    : "bg-green-600/15 ring-2 ring-green-500/50"
                )}
                data-testid="live-panel-a"
              >
                <div className="h-3.5 mb-0.5">
                  {ls.currentThrower === 'A' && (
                    <div className="flex items-center gap-1">
                      <Crosshair className="w-3 h-3 text-red-500" />
                      <span className="text-[9px] font-bold uppercase tracking-wider text-red-500">Throwing</span>
                    </div>
                  )}
                </div>
                <p className="text-xs font-bold truncate">{ls.playerAName}</p>
                <p className="text-4xl font-bold tabular-nums leading-none mt-1" data-testid="live-remaining-a">{ls.remainingA}</p>
                <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Avg</span>
                    <span className="font-medium tabular-nums text-foreground">{ls.avgA}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last</span>
                    <span className="font-medium tabular-nums text-foreground">{ls.lastScoreA !== null ? ls.lastScoreA : '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Darts</span>
                    <span className="font-medium tabular-nums text-foreground">{ls.dartsA}</span>
                  </div>
                </div>
              </div>
              <div
                className={cn(
                  "rounded-lg p-3 transition-all",
                  ls.currentThrower === 'B'
                    ? "bg-red-600/15 ring-2 ring-red-500/50"
                    : "bg-green-600/15 ring-2 ring-green-500/50"
                )}
                data-testid="live-panel-b"
              >
                <div className="h-3.5 mb-0.5">
                  {ls.currentThrower === 'B' && (
                    <div className="flex items-center gap-1">
                      <Crosshair className="w-3 h-3 text-red-500" />
                      <span className="text-[9px] font-bold uppercase tracking-wider text-red-500">Throwing</span>
                    </div>
                  )}
                </div>
                <p className="text-xs font-bold truncate">{ls.playerBName}</p>
                <p className="text-4xl font-bold tabular-nums leading-none mt-1" data-testid="live-remaining-b">{ls.remainingB}</p>
                <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Avg</span>
                    <span className="font-medium tabular-nums text-foreground">{ls.avgB}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last</span>
                    <span className="font-medium tabular-nums text-foreground">{ls.lastScoreB !== null ? ls.lastScoreB : '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Darts</span>
                    <span className="font-medium tabular-nums text-foreground">{ls.dartsB}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center min-h-[100px] text-center">
            <p className="text-lg font-bold">
              {playerA?.name || "TBD"}
              <span className="text-muted-foreground text-xs uppercase font-medium tracking-wider mx-2">vs</span>
              {playerB?.name || "TBD"}
            </p>
          </div>
        )}
        {match.scorerName && (
          <p className="mt-2 text-[11px] text-muted-foreground text-center" data-testid={`public-live-scorer-${match.id}`}>
            Scorer: {match.scorerName}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function PublicView() {
  const { shareToken } = useParams();
  const { data, isLoading, error, refetch } = usePublicTournament(shareToken || "");
  const { socket, joinPublic, on } = useSocket();
  const [liveScorings, setLiveScorings] = useState<Map<number, LiveScoring>>(new Map());
  const matchesRef = useRef(data?.matches);
  matchesRef.current = data?.matches;

  useEffect(() => {
    if (!shareToken) return;
    joinPublic(shareToken);
    const handleReconnect = () => {
      joinPublic(shareToken);
      refetch();
    };
    socket.on("connect", handleReconnect);
    return () => { socket.off("connect", handleReconnect); };
  }, [shareToken, joinPublic, socket, refetch]);

  useEffect(() => {
    const cleanup1 = on("match:updated", () => { refetch(); });
    const cleanup2 = on("tournament:updated", () => refetch());
    const cleanup3 = on("leg:scoring", (incoming: LiveScoring) => {
      setLiveScorings(prev => {
        const next = new Map(prev);
        next.set(incoming.matchId, incoming);
        return next;
      });
    });
    return () => { cleanup1(); cleanup2(); cleanup3(); };
  }, [on, refetch]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <h1 className="text-2xl font-bold">Tournament Not Found</h1>
        <p className="text-muted-foreground mt-2">This link might be invalid or expired.</p>
      </div>
    );
  }

  const { tournament, players, matches, groups } = data;

  const ptsWin = (tournament.settings as any)?.pointsForWin ?? 2;
  const ptsLoss = (tournament.settings as any)?.pointsForLoss ?? 0;

  const computeStandings = (playerList: typeof players, matchList: typeof matches) => {
    return calcStandings(playerList, matchList, ptsWin, ptsLoss);
  };

  const groupStandings = groups.length > 0
    ? groups.map(group => {
        const groupMatches = matches.filter(m => m.groupId === group.id);
        const groupPlayerIds = new Set<number>();
        groupMatches.forEach(m => {
          if (m.playerAId) groupPlayerIds.add(m.playerAId);
          if (m.playerBId) groupPlayerIds.add(m.playerBId);
        });
        const groupPlayers = players.filter(p => groupPlayerIds.has(p.id));
        return { group, standings: computeStandings(groupPlayers, groupMatches) };
      })
    : [{ group: null, standings: computeStandings(players, matches) }];

  const knockoutRoundOrder: Record<string, number> = {
    'QF': 1,
    'Quarter Final': 1,
    'Quarter Finals': 1,
    'Quarter-Final': 1,
    'SF': 2,
    'Semi Final': 2,
    'Semi Finals': 2,
    'Semi-Final': 2,
    'F': 3,
    'Final': 3,
    'GF': 4,
    'Grand Final': 4,
  };

  const roundDisplayNames: Record<string, string> = { QF: 'Quarter-Final', SF: 'Semi-Final', F: 'Final', GF: 'Grand Final' };

  const matchesByRound = matches.reduce((acc, match) => {
    const rawKey = match.groupId ? (groups.find(g => g.id === match.groupId)?.name || 'Group') : (match.roundKey || 'Other');
    const key = roundDisplayNames[rawKey] || rawKey;
    if (!acc[key]) acc[key] = [];
    acc[key].push(match);
    return acc;
  }, {} as Record<string, typeof matches>);

  const sortedRoundEntries = Object.entries(matchesByRound).sort(([a, aMatches], [b, bMatches]) => {
    const aIsGroup = groups.some(g => g.name === a);
    const bIsGroup = groups.some(g => g.name === b);
    const aAllCompleted = aMatches.every(m => m.status === 'COMPLETED');
    const bAllCompleted = bMatches.every(m => m.status === 'COMPLETED');

    if (aIsGroup && bIsGroup) {
      if (aAllCompleted && !bAllCompleted) return 1;
      if (!aAllCompleted && bAllCompleted) return -1;
      return a.localeCompare(b);
    }
    if (!aIsGroup && !bIsGroup) {
      const aOrder = knockoutRoundOrder[a] ?? 0;
      const bOrder = knockoutRoundOrder[b] ?? 0;
      if (aAllCompleted && bAllCompleted) return bOrder - aOrder;
      if (aAllCompleted && !bAllCompleted) return 1;
      if (!aAllCompleted && bAllCompleted) return -1;
      return aOrder - bOrder;
    }
    if (aIsGroup && aAllCompleted) return 1;
    if (bIsGroup && bAllCompleted) return -1;
    if (aIsGroup) return -1;
    return 1;
  });

  for (const [, roundMatches] of sortedRoundEntries) {
    roundMatches.sort((a, b) => {
      const aCompleted = a.status === 'COMPLETED' ? 1 : 0;
      const bCompleted = b.status === 'COMPLETED' ? 1 : 0;
      if (aCompleted !== bCompleted) return aCompleted - bCompleted;
      if (aCompleted && bCompleted) return (b.order || 0) - (a.order || 0);
      return (a.order || 0) - (b.order || 0);
    });
  }

  const getPlayer = (id: number | null) => players.find(p => p.id === id) || null;

  const { theme, toggleTheme } = useTheme();

  const groupStageMatches = matches.filter(m => m.stage === 'GROUP');
  const knockoutStageMatches = matches.filter(m => m.stage !== 'GROUP');
  const groupsFinished = groupStageMatches.length > 0 && groupStageMatches.every(m => m.status === 'COMPLETED');

  const liveMatches = matches
    .filter(m => m.status === 'IN_PROGRESS')
    .sort((a, b) => {
      const groupA = a.groupId ? (groups.find(g => g.id === a.groupId)?.name || '') : '';
      const groupB = b.groupId ? (groups.find(g => g.id === b.groupId)?.name || '') : '';
      return groupA.localeCompare(groupB);
    });

  const getRoundDisplayName = (rk: string) => {
    const names: Record<string, string> = { QF: 'Quarter Final', SF: 'Semi Final', F: 'Final', GF: 'Grand Final' };
    return names[rk] || rk;
  };

  const groupSlots = groups.length > 0 && !groupsFinished
    ? groups
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .map(group => {
          const gMatches = matches
            .filter(m => m.groupId === group.id)
            .sort((a, b) => (a.order || 0) - (b.order || 0));
          const allDone = gMatches.length > 0 && gMatches.every(m => m.status === 'COMPLETED');
          const liveMatch = gMatches.find(m => m.status === 'IN_PROGRESS');
          const nextPending = gMatches.find(m => m.status === 'PENDING' || m.status === 'NOT_STARTED');
          const currentMatch = liveMatch || nextPending || null;
          return { group, currentMatch, isLive: !!liveMatch, allDone };
        })
    : [];

  const knockoutCards: { match?: typeof matches[0]; isLive: boolean; label: string; allDone?: boolean }[] = [];
  if (groupsFinished && knockoutStageMatches.length > 0) {
    const knockoutRounds = Array.from(new Set(knockoutStageMatches.map(m => m.roundKey))) as string[];
    const koOrder: Record<string, number> = { QF: 1, SF: 2, F: 3, GF: 4 };
    knockoutRounds.sort((a, b) => (koOrder[a] || 0) - (koOrder[b] || 0));

    let currentRoundKey: string | null = null;
    for (const rk of knockoutRounds) {
      const roundMatches = knockoutStageMatches.filter(m => m.roundKey === rk);
      if (!roundMatches.every(m => m.status === 'COMPLETED')) {
        currentRoundKey = rk;
        break;
      }
    }

    if (!currentRoundKey) {
      currentRoundKey = knockoutRounds[knockoutRounds.length - 1];
    }

    const currentRoundIndex = knockoutRounds.indexOf(currentRoundKey!);
    for (let i = 0; i <= currentRoundIndex; i++) {
      const rk = knockoutRounds[i];
      const roundName = getRoundDisplayName(rk);
      const roundMatches = knockoutStageMatches
        .filter(m => m.roundKey === rk)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      if (i < currentRoundIndex) {
        knockoutCards.push({ isLive: false, label: roundName, allDone: true });
      } else {
        roundMatches.forEach((match, j) => {
          knockoutCards.push({
            match,
            isLive: match.status === 'IN_PROGRESS',
            label: `${roundName}${roundMatches.length > 1 ? ` ${j + 1}` : ''}`,
          });
        });
      }
    }
  }

  const hasGroupMatches = groupStageMatches.length > 0;
  const showGroupSlots = hasGroupMatches && !groupsFinished && groupSlots.length > 0;
  const showKnockoutSection = groupsFinished && knockoutCards.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Public Header */}
      <div className="bg-primary text-primary-foreground py-6 px-4 shadow-lg">
        <div className="container max-w-6xl mx-auto flex items-center justify-between">
          <div className="shrink-0">
            <img src={tkoLogoFull} alt="TKO" className="h-12 md:h-14" data-testid="img-tko-logo" />
            <p className="text-primary-foreground/70 text-xs mt-1 tracking-wide whitespace-nowrap">The Ultimate Tournament Generator</p>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            data-testid="button-toggle-theme-public"
          >
            {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className="container max-w-6xl mx-auto px-4 pb-12">
        <div className="flex flex-wrap items-center gap-3 py-4 mb-4 border-b">
          <h1 className="text-xl md:text-2xl font-display font-bold" data-testid="text-tournament-name">{tournament.name}</h1>
          <Badge variant="outline">
            {tournament.type.replace('_', ' ')}
          </Badge>
          <span className="text-muted-foreground text-sm">{players.length} Players</span>
          {liveMatches.length > 0 && (
            <span className="flex items-center gap-1 text-sm">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              {liveMatches.length} Live {liveMatches.length === 1 ? 'Game' : 'Games'}
            </span>
          )}
        </div>

        {showGroupSlots && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <h2 className="text-xl font-display font-bold">Live Games</h2>
              {liveMatches.length > 0 && (
                <Badge variant="secondary" className="ml-1">{liveMatches.length}</Badge>
              )}
            </div>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {groupSlots.map(({ group, currentMatch, isLive, allDone }) => {
                if (allDone) {
                  return (
                    <Card key={`completed-${group.id}`} className="border-2 border-dashed" data-testid={`completed-group-${group.id}`}>
                      <CardContent className="py-12 text-center">
                        <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold mb-2">{group.name} matches complete</h2>
                        <p className="text-muted-foreground">Waiting on other matches to finish</p>
                      </CardContent>
                    </Card>
                  );
                }

                if (!currentMatch) {
                  return (
                    <Card key={`waiting-${group.id}`} className="border border-dashed border-muted-foreground/30 shadow-none">
                      <CardHeader className="bg-muted/30 border-b py-2.5 px-4">
                        <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                          {group.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex items-center justify-center py-8 px-4">
                        <p className="text-sm text-muted-foreground text-center">No matches scheduled yet</p>
                      </CardContent>
                    </Card>
                  );
                }

                const playerA = getPlayer(currentMatch.playerAId);
                const playerB = getPlayer(currentMatch.playerBId);

                if (isLive) {
                  const ls = liveScorings.get(currentMatch.id);
                  return (
                    <LiveMatchCard
                      key={currentMatch.id}
                      match={currentMatch}
                      ls={ls}
                      playerA={playerA}
                      playerB={playerB}
                      headerLabel={group.name || 'Live'}
                    />
                  );
                }

                return (
                  <KnockoutMatchCard
                    key={currentMatch.id}
                    match={currentMatch}
                    playerA={playerA}
                    playerB={playerB}
                    label={group.name || 'Group'}
                    isCompleted={false}
                    shareToken={shareToken || ''}
                  />
                );
              })}
            </div>
          </div>
        )}

        {showKnockoutSection && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <h2 className="text-xl font-display font-bold">Knockout Stage</h2>
              {liveMatches.length > 0 && (
                <Badge variant="default" className="ml-1 bg-green-600">{liveMatches.length} Live</Badge>
              )}
            </div>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {knockoutCards.map(({ match, isLive, label, allDone }, idx) => {
                if (allDone) {
                  return (
                    <Card key={`ko-done-${idx}`} className="border-2 border-dashed" data-testid={`completed-ko-${label.replace(/\s+/g, '-').toLowerCase()}`}>
                      <CardContent className="py-12 text-center">
                        <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold mb-2">{label} matches complete</h2>
                        <p className="text-muted-foreground">Waiting on other matches to finish</p>
                      </CardContent>
                    </Card>
                  );
                }

                const ls = liveScorings.get(match!.id);
                const playerA = getPlayer(match!.playerAId);
                const playerB = getPlayer(match!.playerBId);
                const isCompleted = match!.status === 'COMPLETED';

                if (isLive) {
                  return <LiveMatchCard key={match!.id} match={match!} ls={ls} playerA={playerA} playerB={playerB} headerLabel={label} />;
                }

                return (
                  <KnockoutMatchCard
                    key={match!.id}
                    match={match!}
                    playerA={playerA}
                    playerB={playerB}
                    label={label}
                    isCompleted={isCompleted}
                    shareToken={shareToken || ''}
                  />
                );
              })}
            </div>
          </div>
        )}

        <Tabs defaultValue="standings" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
            <TabsTrigger value="standings">Standings</TabsTrigger>
            <TabsTrigger value="matches">Matches</TabsTrigger>
          </TabsList>

          <TabsContent value="standings" className="space-y-6">
            {groupStandings.map(({ group, standings }) => (
              <Card key={group?.id ?? 'all'} className="shadow-md overflow-hidden" data-testid={`standings-${group?.id ?? 'all'}`}>
                <CardHeader className="py-4 px-4 border-b">
                  <CardTitle className="text-foreground flex items-center gap-2 text-lg font-bold">
                    {group ? group.name : 'Standings'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full table-fixed">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="w-[6%] py-3 px-3 text-left text-sm font-medium text-muted-foreground">#</th>
                        <th className="w-[24%] py-3 px-3 text-left text-sm font-medium text-muted-foreground">Player</th>
                        <th className="w-[10%] py-3 px-2 text-center text-sm font-medium text-muted-foreground">P</th>
                        <th className="w-[10%] py-3 px-2 text-center text-sm font-medium text-muted-foreground">W</th>
                        <th className="w-[10%] py-3 px-2 text-center text-sm font-medium text-muted-foreground">L</th>
                        <th className="w-[10%] py-3 px-2 text-center text-sm font-medium text-muted-foreground">LW</th>
                        <th className="w-[10%] py-3 px-2 text-center text-sm font-medium text-muted-foreground">LL</th>
                        <th className="w-[10%] py-3 px-2 text-center text-sm font-medium text-muted-foreground">+/-</th>
                        <th className="w-[10%] py-3 px-2 text-center text-sm font-medium text-muted-foreground">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((player, idx) => {
                        const qualifying = idx < 2;
                        return (
                        <tr key={player.id} className={cn("border-b last:border-0 hover:bg-muted/40 transition-colors", qualifying && "bg-green-50 dark:bg-green-950/30")} data-testid={`row-standing-${player.id}`}>
                          <td className="py-4 px-3 text-sm text-muted-foreground font-medium">
                            <div className="flex items-center gap-1.5">
                              {idx + 1}
                              {qualifying && <div className="w-2 h-2 rounded-full bg-green-500" />}
                            </div>
                          </td>
                          <td className={cn("py-4 px-3 font-bold text-sm truncate", qualifying && "text-green-700 dark:text-green-400")}>{player.name}</td>
                          <td className="py-4 px-2 text-center text-sm tabular-nums">{player.played}</td>
                          <td className="py-4 px-2 text-center text-sm tabular-nums text-green-600 dark:text-green-400 font-medium">{player.won}</td>
                          <td className="py-4 px-2 text-center text-sm tabular-nums text-destructive font-medium">{player.lost}</td>
                          <td className="py-4 px-2 text-center text-sm tabular-nums">{player.legsFor}</td>
                          <td className="py-4 px-2 text-center text-sm tabular-nums">{player.legsAgainst}</td>
                          <td className={cn(
                            "py-4 px-2 text-center text-sm tabular-nums font-medium",
                            player.diff > 0 ? "text-green-600" : player.diff < 0 ? "text-destructive" : ""
                          )}>
                            {player.diff > 0 ? `+${player.diff}` : player.diff}
                          </td>
                          <td className={cn(
                            "py-4 px-2 text-center font-bold text-base",
                            qualifying ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                          )}>{player.pts}</td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="matches" className="space-y-6">
            {sortedRoundEntries.map(([roundName, roundMatches]) => (
              <Card key={roundName} className="overflow-hidden">
                <CardHeader className="bg-muted/50 border-b">
                  <CardTitle className="text-lg">{roundName}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {roundMatches.map((match) => {
                      const playerA = getPlayer(match.playerAId);
                      const playerB = getPlayer(match.playerBId);
                      return (
                        <CompletedMatchRow
                          key={match.id}
                          match={match}
                          playerA={playerA}
                          playerB={playerB}
                          shareToken={shareToken || ''}
                          scorerName={match.scorerName || null}
                        />
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
