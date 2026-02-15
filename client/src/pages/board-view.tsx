import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, Trophy, Target, Wifi, WifiOff } from "lucide-react";
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
import { cn } from "@/lib/utils";

interface BoardData {
  tournament: {
    id: number;
    name: string;
    type: string;
    status: string;
    settings: any;
  };
  group: {
    id: number;
    name: string;
  };
  boardNumber: number;
  totalBoards: number;
  players: Array<{
    id: number;
    name: string;
  }>;
  matches: Array<{
    id: number;
    playerAId: number | null;
    playerBId: number | null;
    scoreA: number | null;
    scoreB: number | null;
    status: string;
    winnerId: number | null;
    roundKey: string | null;
    groupId: number | null;
    matchOrder: number | null;
  }>;
}

export default function BoardView() {
  const { shareToken, boardNumber } = useParams();
  const { joinPublic, joinBoard, on, socket } = useSocket();
  const [isConnected, setIsConnected] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<BoardData>({
    queryKey: ['/api/public/t', shareToken, 'board', boardNumber],
    queryFn: async () => {
      const res = await fetch(`/api/public/t/${shareToken}/board/${boardNumber}`);
      if (!res.ok) throw new Error("Failed to fetch board data");
      return res.json();
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (shareToken) joinPublic(shareToken);
    if (data?.tournament?.id && boardNumber && shareToken) {
      joinBoard(data.tournament.id, parseInt(boardNumber), shareToken);
    }
  }, [shareToken, data?.tournament?.id, boardNumber, joinPublic, joinBoard]);

  useEffect(() => {
    const cleanup1 = on("connect", () => setIsConnected(true));
    const cleanup2 = on("disconnect", () => setIsConnected(false));
    const cleanup3 = on("match:updated", () => refetch());
    const cleanup4 = on("tournament:updated", () => refetch());
    setIsConnected(socket.connected);
    return () => { cleanup1(); cleanup2(); cleanup3(); cleanup4(); };
  }, [on, socket, refetch]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="board-loading">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4" data-testid="board-error">
        <Target className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold">Board Not Found</h1>
        <p className="text-muted-foreground mt-2">This board link might be invalid or the tournament sharing is disabled.</p>
      </div>
    );
  }

  const { tournament, group, boardNumber: boardNum, totalBoards, players, matches } = data;
  const getPlayer = (id: number | null) => players.find(p => p.id === id) || null;

  const ptsWin = (tournament.settings as any)?.pointsForWin ?? 2;
  const ptsDraw = (tournament.settings as any)?.pointsForDraw ?? 1;
  const ptsLoss = (tournament.settings as any)?.pointsForLoss ?? 0;

  const completedMatches = matches.filter(m => m.status === 'COMPLETED');

  const standings = players.map(player => {
    const playerMatches = completedMatches.filter(m =>
      m.playerAId === player.id || m.playerBId === player.id
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
    return {
      ...player, played, won, drawn, lost, legsFor, legsAgainst,
      diff: legsFor - legsAgainst,
      pts: (won * ptsWin) + (drawn * ptsDraw) + (lost * ptsLoss)
    };
  }).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.legsFor !== a.legsFor) return b.legsFor - a.legsFor;
    const h2h = completedMatches.find(m =>
      (m.playerAId === a.id && m.playerBId === b.id) ||
      (m.playerAId === b.id && m.playerBId === a.id)
    );
    if (h2h) {
      if (h2h.winnerId === a.id) return -1;
      if (h2h.winnerId === b.id) return 1;
    }
    return 0;
  });

  const currentMatch = matches.find(m => m.status === 'IN_PROGRESS');
  const nextPending = matches.find(m => m.status === 'PENDING');

  return (
    <div className="min-h-screen bg-background" data-testid="board-view">
      <div className="bg-primary text-primary-foreground py-8 px-4 shadow-lg mb-6">
        <div className="container max-w-3xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Target className="w-7 h-7" />
                <h1 className="text-2xl md:text-3xl font-display font-bold" data-testid="text-tournament-name">{tournament.name}</h1>
              </div>
              <p className="text-primary-foreground/80 text-sm" data-testid="text-board-subtitle">
                {group.name} — Board {boardNum} of {totalBoards}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Wifi className="w-4 h-4 text-green-300" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-300" />
              )}
              <Badge variant="outline" className="border-white/30 text-white text-base px-3 py-1" data-testid="badge-board-number">
                Board {boardNum}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-3xl mx-auto px-4 pb-12 space-y-6">
        {currentMatch && (
          <Card className="border-2 border-primary shadow-xl" data-testid="card-current-match">
            <CardHeader className="bg-primary/10 border-b pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                Now Playing
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 pb-4">
              <div className="flex items-center justify-between text-center">
                <div className="flex-1">
                  <p className="text-xl font-bold" data-testid="text-current-playerA">{getPlayer(currentMatch.playerAId)?.name || "TBD"}</p>
                </div>
                <div className="flex items-center gap-4 px-4">
                  <span className="text-3xl font-bold" data-testid="text-current-scoreA">{currentMatch.scoreA || 0}</span>
                  <span className="text-muted-foreground text-sm uppercase font-medium">vs</span>
                  <span className="text-3xl font-bold" data-testid="text-current-scoreB">{currentMatch.scoreB || 0}</span>
                </div>
                <div className="flex-1">
                  <p className="text-xl font-bold" data-testid="text-current-playerB">{getPlayer(currentMatch.playerBId)?.name || "TBD"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!currentMatch && nextPending && (
          <Card className="border border-dashed border-primary/50" data-testid="card-next-match">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-muted-foreground">Up Next</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-center">
                <div className="flex-1">
                  <p className="text-lg font-semibold" data-testid="text-next-playerA">{getPlayer(nextPending.playerAId)?.name || "TBD"}</p>
                </div>
                <span className="text-muted-foreground text-sm uppercase font-medium px-4">vs</span>
                <div className="flex-1">
                  <p className="text-lg font-semibold" data-testid="text-next-playerB">{getPlayer(nextPending.playerBId)?.name || "TBD"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-t-4 border-t-primary shadow-xl" data-testid="card-standings">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              {group.name} Standings
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
                  <TableHead className="text-center">Diff</TableHead>
                  <TableHead className="text-right font-bold">Pts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {standings.map((player, idx) => (
                  <TableRow key={player.id} className={idx === 0 ? "bg-yellow-50 dark:bg-yellow-900/10" : ""} data-testid={`row-standing-${player.id}`}>
                    <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-bold">{player.name}</TableCell>
                    <TableCell className="text-center">{player.played}</TableCell>
                    <TableCell className="text-center text-green-600">{player.won}</TableCell>
                    <TableCell className="text-center text-red-500">{player.lost}</TableCell>
                    <TableCell className="text-center font-mono">
                      {player.diff > 0 ? `+${player.diff}` : player.diff}
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary text-lg">{player.pts}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {completedMatches.length > 0 && (
          <Card data-testid="card-completed-matches">
            <CardHeader className="bg-muted/50 border-b">
              <CardTitle className="text-lg">Completed Matches</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {completedMatches.map((match) => {
                  const playerA = getPlayer(match.playerAId);
                  const playerB = getPlayer(match.playerBId);
                  return (
                    <div key={match.id} className="flex items-center justify-between p-4" data-testid={`row-match-${match.id}`}>
                      <div className={cn("flex-1 text-right font-medium", match.winnerId === match.playerAId && "text-primary font-bold")}>
                        {playerA?.name || "TBD"}
                      </div>
                      <div className="flex items-center gap-3 px-6">
                        <span className={cn("text-xl font-bold", (match.scoreA || 0) > (match.scoreB || 0) ? "text-primary" : "text-muted-foreground")}>
                          {match.scoreA || 0}
                        </span>
                        <span className="text-muted-foreground text-xs uppercase font-medium">-</span>
                        <span className={cn("text-xl font-bold", (match.scoreB || 0) > (match.scoreA || 0) ? "text-primary" : "text-muted-foreground")}>
                          {match.scoreB || 0}
                        </span>
                      </div>
                      <div className={cn("flex-1 text-left font-medium", match.winnerId === match.playerBId && "text-primary font-bold")}>
                        {playerB?.name || "TBD"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
