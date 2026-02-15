import { useParams } from "wouter";
import { useEffect, useState } from "react";
import { usePublicTournament } from "@/hooks/use-tournaments";
import { Loader2, Trophy, Eye } from "lucide-react";
import { useSocket } from "@/hooks/use-socket";
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

export default function PublicView() {
  const { shareToken } = useParams();
  const { data, isLoading, error, refetch } = usePublicTournament(shareToken || "");
  const { joinPublic, on } = useSocket();
  const [liveScorings, setLiveScorings] = useState<Map<number, LiveScoring>>(new Map());

  useEffect(() => {
    if (shareToken) joinPublic(shareToken);
  }, [shareToken, joinPublic]);

  useEffect(() => {
    const cleanup1 = on("match:updated", () => { setLiveScorings(new Map()); refetch(); });
    const cleanup2 = on("tournament:updated", () => refetch());
    const cleanup3 = on("leg:scoring", (incoming: LiveScoring) => {
      const currentMatches = data?.matches;
      if (!currentMatches) return;
      const isOurMatch = currentMatches.some(m => m.id === incoming.matchId && m.status === 'IN_PROGRESS');
      if (!isOurMatch) return;
      setLiveScorings(prev => {
        const next = new Map(prev);
        next.set(incoming.matchId, incoming);
        return next;
      });
    });
    return () => { cleanup1(); cleanup2(); cleanup3(); };
  }, [on, refetch, data?.matches]);

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

  // Reused logic for standings (ideal: move to shared helper)
  const standings = players.map(player => {
    const playerMatches = matches.filter(m => 
      (m.playerAId === player.id || m.playerBId === player.id) && m.status === 'COMPLETED'
    );
    let played = 0, won = 0, lost = 0, diff = 0;
    playerMatches.forEach(m => {
      played++;
      const isA = m.playerAId === player.id;
      const myScore = isA ? (m.scoreA || 0) : (m.scoreB || 0);
      const oppScore = isA ? (m.scoreB || 0) : (m.scoreA || 0);
      diff += (myScore - oppScore);
      if (m.winnerId === player.id) won++; else lost++;
    });
    return { ...player, played, won, lost, diff, pts: won * 2 };
  }).sort((a, b) => b.pts - a.pts || b.diff - a.diff);

  const matchesByRound = matches.reduce((acc, match) => {
    const key = match.groupId ? (groups.find(g => g.id === match.groupId)?.name || 'Group') : match.roundKey;
    if (!acc[key]) acc[key] = [];
    acc[key].push(match);
    return acc;
  }, {} as Record<string, typeof matches>);

  const getPlayer = (id: number | null) => players.find(p => p.id === id) || null;

  const liveMatches = matches.filter(m => m.status === 'IN_PROGRESS');
  const activeLiveScorings = liveMatches
    .map(m => liveScorings.get(m.id))
    .filter((ls): ls is LiveScoring => ls != null);

  return (
    <div className="min-h-screen bg-background">
      {/* Public Header */}
      <div className="bg-primary text-primary-foreground py-12 px-4 shadow-lg mb-8">
        <div className="container max-w-5xl mx-auto flex justify-between items-center">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Trophy className="w-8 h-8" />
              <h1 className="text-3xl md:text-4xl font-display font-bold">{tournament.name}</h1>
            </div>
            <div className="flex gap-2 items-center text-primary-foreground/80">
              <Badge variant="outline" className="border-white/30 text-white">
                {tournament.type.replace('_', ' ')}
              </Badge>
              <span>•</span>
              <span>{players.length} Players</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-5xl mx-auto px-4 pb-12">
        {activeLiveScorings.length > 0 && (
          <div className="mb-6 space-y-4">
            {activeLiveScorings.map(ls => (
              <Card key={ls.matchId} className="border-2 border-primary shadow-xl overflow-hidden" data-testid={`live-match-${ls.matchId}`}>
                <CardHeader className="bg-primary/10 border-b pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                    Live Match
                    <span className="text-xs text-muted-foreground ml-auto">
                      Leg {(ls.legsWonA + ls.legsWonB + 1)} — Best of {ls.bestOf}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 pb-4">
                  <div className="text-center mb-3">
                    <div className="flex items-center justify-center gap-3 tabular-nums">
                      <span className={cn("text-3xl font-bold", ls.legsWonA >= ls.legsWonB ? "text-primary" : "text-muted-foreground")}>{ls.legsWonA}</span>
                      <span className="text-muted-foreground text-lg">-</span>
                      <span className={cn("text-3xl font-bold", ls.legsWonB >= ls.legsWonA ? "text-primary" : "text-muted-foreground")}>{ls.legsWonB}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      className={cn(
                        "rounded-xl p-4 transition-all",
                        ls.currentThrower === 'A'
                          ? "bg-red-600/15 ring-2 ring-red-500/50"
                          : "bg-green-600/15 ring-2 ring-green-500/50"
                      )}
                    >
                      <div className="h-4 mb-1">
                        {ls.currentThrower === 'A' && (
                          <div className="flex items-center gap-1">
                            <Eye className="w-3 h-3 text-red-500" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-red-500">Throwing</span>
                          </div>
                        )}
                      </div>
                      <p className="text-sm font-bold truncate">{ls.playerAName}</p>
                      <p className="text-5xl font-bold tabular-nums leading-none mt-1">{ls.remainingA}</p>
                      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                        <div className="flex justify-between">
                          <span>3-dart avg.</span>
                          <span className="font-medium tabular-nums text-foreground">{ls.avgA}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Last score</span>
                          <span className="font-medium tabular-nums text-foreground">{ls.lastScoreA !== null ? ls.lastScoreA : '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Darts thrown</span>
                          <span className="font-medium tabular-nums text-foreground">{ls.dartsA}</span>
                        </div>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "rounded-xl p-4 transition-all",
                        ls.currentThrower === 'B'
                          ? "bg-red-600/15 ring-2 ring-red-500/50"
                          : "bg-green-600/15 ring-2 ring-green-500/50"
                      )}
                    >
                      <div className="h-4 mb-1">
                        {ls.currentThrower === 'B' && (
                          <div className="flex items-center gap-1">
                            <Eye className="w-3 h-3 text-red-500" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-red-500">Throwing</span>
                          </div>
                        )}
                      </div>
                      <p className="text-sm font-bold truncate">{ls.playerBName}</p>
                      <p className="text-5xl font-bold tabular-nums leading-none mt-1">{ls.remainingB}</p>
                      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                        <div className="flex justify-between">
                          <span>3-dart avg.</span>
                          <span className="font-medium tabular-nums text-foreground">{ls.avgB}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Last score</span>
                          <span className="font-medium tabular-nums text-foreground">{ls.lastScoreB !== null ? ls.lastScoreB : '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Darts thrown</span>
                          <span className="font-medium tabular-nums text-foreground">{ls.dartsB}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Tabs defaultValue="standings" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
            <TabsTrigger value="standings">Standings</TabsTrigger>
            <TabsTrigger value="matches">Matches</TabsTrigger>
          </TabsList>

          <TabsContent value="standings">
            <Card className="border-t-4 border-t-primary shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  Live Leaderboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">#</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead className="text-center">P</TableHead>
                      <TableHead className="text-center">W</TableHead>
                      <TableHead className="text-center">L</TableHead>
                      <TableHead className="text-center hidden md:table-cell">Diff</TableHead>
                      <TableHead className="text-right font-bold">Pts</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {standings.map((player, idx) => (
                      <TableRow key={player.id} className={idx === 0 ? "bg-yellow-50 dark:bg-yellow-900/10" : ""}>
                        <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-bold">{player.name}</TableCell>
                        <TableCell className="text-center">{player.played}</TableCell>
                        <TableCell className="text-center text-green-600">{player.won}</TableCell>
                        <TableCell className="text-center text-red-500">{player.lost}</TableCell>
                        <TableCell className="text-center hidden md:table-cell font-mono">
                          {player.diff > 0 ? `+${player.diff}` : player.diff}
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary text-lg">{player.pts}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="matches" className="space-y-6">
            {Object.entries(matchesByRound).map(([roundName, roundMatches]) => (
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
                        <div key={match.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                          <div className="flex-1 text-right font-medium">
                            {playerA?.name || "TBD"}
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
                            {playerB?.name || "TBD"}
                          </div>
                        </div>
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
