import { useParams } from "wouter";
import { useEffect } from "react";
import { usePublicTournament } from "@/hooks/use-tournaments";
import { Loader2, Trophy } from "lucide-react";
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

export default function PublicView() {
  const { shareToken } = useParams();
  const { data, isLoading, error, refetch } = usePublicTournament(shareToken || "");
  const { joinPublic, on } = useSocket();

  useEffect(() => {
    if (shareToken) joinPublic(shareToken);
  }, [shareToken, joinPublic]);

  useEffect(() => {
    const cleanup1 = on("match:updated", () => refetch());
    const cleanup2 = on("tournament:updated", () => refetch());
    return () => { cleanup1(); cleanup2(); };
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
