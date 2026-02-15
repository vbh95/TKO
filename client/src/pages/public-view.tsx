import { useParams } from "wouter";
import { useEffect, useState } from "react";
import { usePublicTournament } from "@/hooks/use-tournaments";
import { Loader2, Trophy, Eye } from "lucide-react";
import tkoLogoFull from "@assets/TKO_White-03_1771177730967.png";
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
    const cleanup1 = on("match:updated", () => { refetch(); });
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

  const ptsWin = (tournament.settings as any)?.pointsForWin ?? 2;
  const ptsDraw = (tournament.settings as any)?.pointsForDraw ?? 1;
  const ptsLoss = (tournament.settings as any)?.pointsForLoss ?? 0;

  const calcStandings = (playerList: typeof players, matchList: typeof matches) => {
    return playerList.map(player => {
      const playerMatches = matchList.filter(m =>
        (m.playerAId === player.id || m.playerBId === player.id) && m.status === 'COMPLETED'
      );
      let played = 0, won = 0, drawn = 0, lost = 0, legsFor = 0, legsAgainst = 0;
      playerMatches.forEach(m => {
        played++;
        const isA = m.playerAId === player.id;
        const myScore = isA ? (m.scoreA || 0) : (m.scoreB || 0);
        const oppScore = isA ? (m.scoreB || 0) : (m.scoreA || 0);
        legsFor += myScore;
        legsAgainst += oppScore;
        if (m.winnerId === player.id) won++;
        else if (m.winnerId === null && m.status === 'COMPLETED') drawn++;
        else lost++;
      });
      const pts = won * ptsWin + drawn * ptsDraw + lost * ptsLoss;
      const diff = legsFor - legsAgainst;
      return { ...player, played, won, drawn, lost, legsFor, legsAgainst, diff, pts };
    }).sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.legsFor - a.legsFor);
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
        return { group, standings: calcStandings(groupPlayers, groupMatches) };
      })
    : [{ group: null, standings: calcStandings(players, matches) }];

  const matchesByRound = matches.reduce((acc, match) => {
    const key = match.groupId ? (groups.find(g => g.id === match.groupId)?.name || 'Group') : match.roundKey;
    if (!acc[key]) acc[key] = [];
    acc[key].push(match);
    return acc;
  }, {} as Record<string, typeof matches>);

  const getPlayer = (id: number | null) => players.find(p => p.id === id) || null;

  const liveMatches = matches.filter(m => m.status === 'IN_PROGRESS');

  return (
    <div className="min-h-screen bg-background">
      {/* Public Header */}
      <div className="bg-primary text-primary-foreground py-6 px-4 shadow-lg mb-6">
        <div className="container max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <img src={tkoLogoFull} alt="TKO" className="w-full" data-testid="img-tko-logo" />
            <p className="text-primary-foreground/70 text-xs mt-1 tracking-wide whitespace-nowrap">The Ultimate Tournament Generator</p>
          </div>
          <div className="text-right">
            <h1 className="text-xl md:text-2xl font-display font-bold mb-2" data-testid="text-tournament-name">{tournament.name}</h1>
            <div className="flex flex-wrap gap-2 items-center justify-end text-primary-foreground/80 text-sm">
              <Badge variant="outline" className="border-white/30 text-white">
                {tournament.type.replace('_', ' ')}
              </Badge>
              <span>•</span>
              <span>{players.length} Players</span>
              {liveMatches.length > 0 && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    {liveMatches.length} Live {liveMatches.length === 1 ? 'Game' : 'Games'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-6xl mx-auto px-4 pb-12">
        {liveMatches.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <h2 className="text-xl font-display font-bold">Live Games</h2>
              <Badge variant="secondary" className="ml-1">{liveMatches.length}</Badge>
            </div>
            <div className={cn(
              "grid gap-4",
              liveMatches.length === 1 ? "grid-cols-1 max-w-2xl" :
              liveMatches.length === 2 ? "grid-cols-1 md:grid-cols-2" :
              "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
            )}>
              {liveMatches.map(match => {
                const ls = liveScorings.get(match.id);
                const playerA = getPlayer(match.playerAId);
                const playerB = getPlayer(match.playerBId);
                const groupName = match.groupId ? groups.find(g => g.id === match.groupId)?.name : null;

                return (
                  <Card key={match.id} className="border-2 border-primary shadow-xl overflow-hidden" data-testid={`live-match-${match.id}`}>
                    <CardHeader className="bg-primary/10 border-b py-2.5 px-4">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                        {groupName ? groupName : 'Live'}
                        {ls && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            Leg {(ls.legsWonA + ls.legsWonB + 1)} / Best of {ls.bestOf}
                          </span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-3 pb-4 px-4">
                      {ls ? (
                        <div>
                          <div className="text-center mb-2">
                            <div className="flex items-center justify-center gap-3 tabular-nums">
                              <span className={cn("text-2xl font-bold", ls.legsWonA >= ls.legsWonB ? "text-primary" : "text-muted-foreground")}>{ls.legsWonA}</span>
                              <span className="text-muted-foreground text-sm">-</span>
                              <span className={cn("text-2xl font-bold", ls.legsWonB >= ls.legsWonA ? "text-primary" : "text-muted-foreground")}>{ls.legsWonB}</span>
                            </div>
                          </div>
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
                                    <Eye className="w-3 h-3 text-red-500" />
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
                                    <Eye className="w-3 h-3 text-red-500" />
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
                        <div className="flex items-center justify-between text-center py-4">
                          <div className="flex-1">
                            <p className="text-lg font-bold">{playerA?.name || "TBD"}</p>
                          </div>
                          <div className="flex items-center gap-3 px-3">
                            <span className="text-2xl font-bold tabular-nums">{match.scoreA || 0}</span>
                            <span className="text-muted-foreground text-xs uppercase font-medium">vs</span>
                            <span className="text-2xl font-bold tabular-nums">{match.scoreB || 0}</span>
                          </div>
                          <div className="flex-1">
                            <p className="text-lg font-bold">{playerB?.name || "TBD"}</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
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
              <Card key={group?.id ?? 'all'} className="border-t-4 border-t-primary shadow-xl overflow-hidden" data-testid={`standings-${group?.id ?? 'all'}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    {group ? group.name : 'Standings'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px] pl-4">#</TableHead>
                        <TableHead>Player</TableHead>
                        <TableHead className="text-center">P</TableHead>
                        <TableHead className="text-center">W</TableHead>
                        <TableHead className="text-center">L</TableHead>
                        <TableHead className="text-center hidden md:table-cell">LF</TableHead>
                        <TableHead className="text-center hidden md:table-cell">LA</TableHead>
                        <TableHead className="text-center hidden md:table-cell">+/-</TableHead>
                        <TableHead className="text-right font-bold pr-4">Pts</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {standings.map((player, idx) => (
                        <TableRow key={player.id} className={idx === 0 ? "bg-yellow-50 dark:bg-yellow-900/10" : ""} data-testid={`row-standing-${player.id}`}>
                          <TableCell className="font-medium text-muted-foreground pl-4">{idx + 1}</TableCell>
                          <TableCell className="font-bold">{player.name}</TableCell>
                          <TableCell className="text-center">{player.played}</TableCell>
                          <TableCell className="text-center text-green-600">{player.won}</TableCell>
                          <TableCell className="text-center text-red-500">{player.lost}</TableCell>
                          <TableCell className="text-center hidden md:table-cell">{player.legsFor}</TableCell>
                          <TableCell className="text-center hidden md:table-cell">{player.legsAgainst}</TableCell>
                          <TableCell className="text-center hidden md:table-cell font-mono">
                            {player.diff > 0 ? `+${player.diff}` : player.diff}
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary text-lg pr-4">{player.pts}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
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
