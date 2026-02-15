import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { Loader2, Target, Trophy, Check, Wifi, WifiOff, Play, ChevronRight, ArrowLeft, Minus, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useSocket } from "@/hooks/use-socket";
import { useToast } from "@/hooks/use-toast";

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
    bestOf: number;
    roundKey: string | null;
    groupId: number | null;
    order: number;
  }>;
  accessToken?: string;
}

type ScorerView = "matchList" | "scoring";

export default function ScorerPage() {
  const params = useParams<{ tournamentId: string; boardNumber: string }>();
  const tournamentId = parseInt(params.tournamentId || "0");
  const boardNumber = parseInt(params.boardNumber || "0");
  const { toast } = useToast();
  const { joinScorer, joinBoard, on, socket } = useSocket();
  const [isConnected, setIsConnected] = useState(false);
  const [view, setView] = useState<ScorerView>("matchList");
  const [activeMatchId, setActiveMatchId] = useState<number | null>(null);
  const [legScoreA, setLegScoreA] = useState(0);
  const [legScoreB, setLegScoreB] = useState(0);

  const { data, isLoading, error, refetch } = useQuery<BoardData>({
    queryKey: ['/api/scorer/board-data'],
    queryFn: async () => {
      const res = await fetch('/api/scorer/board-data', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401) throw new Error("Not paired. Please scan the QR code to pair this device.");
        throw new Error("Failed to fetch board data");
      }
      return res.json();
    },
  });

  useEffect(() => {
    if (data?.accessToken) {
      joinScorer(data.accessToken);
      joinBoard(tournamentId, boardNumber);
    }
  }, [data?.accessToken, tournamentId, boardNumber, joinScorer, joinBoard]);

  useEffect(() => {
    if (data && view === "matchList" && activeMatchId === null) {
      const inProgress = data.matches.find(m => m.status === 'IN_PROGRESS');
      if (inProgress) {
        setActiveMatchId(inProgress.id);
        setLegScoreA(inProgress.scoreA || 0);
        setLegScoreB(inProgress.scoreB || 0);
        setView("scoring");
      }
    }
  }, [data, view, activeMatchId]);

  useEffect(() => {
    const cleanup1 = on("connect", () => setIsConnected(true));
    const cleanup2 = on("disconnect", () => setIsConnected(false));
    const cleanup3 = on("match:updated", () => {
      refetch();
    });
    setIsConnected(socket.connected);
    return () => { cleanup1(); cleanup2(); cleanup3(); };
  }, [on, socket, refetch]);

  const startMatchMutation = useMutation({
    mutationFn: async (matchId: number) => {
      const res = await fetch(`/api/scorer/matches/${matchId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to start match");
      }
      return res.json();
    },
    onSuccess: (_, matchId) => {
      setActiveMatchId(matchId);
      setLegScoreA(0);
      setLegScoreB(0);
      setView("scoring");
      refetch();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const submitScoreMutation = useMutation({
    mutationFn: async ({ matchId, scoreA, scoreB }: { matchId: number; scoreA: number; scoreB: number }) => {
      const res = await fetch(`/api/scorer/matches/${matchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ scoreA, scoreB }),
      });
      if (!res.ok) throw new Error("Failed to update score");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Match complete!" });
      setActiveMatchId(null);
      setView("matchList");
      refetch();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateLegMutation = useMutation({
    mutationFn: async ({ matchId, scoreA, scoreB }: { matchId: number; scoreA: number; scoreB: number }) => {
      const res = await fetch(`/api/scorer/matches/${matchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ scoreA, scoreB }),
      });
      if (!res.ok) throw new Error("Failed to update score");
      return res.json();
    },
    onSuccess: () => {
      refetch();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4 bg-background">
        <Target className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold">Scorer Not Paired</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          {(error as any)?.message || "This device isn't paired to a board. Scan the QR code from the tournament admin to pair."}
        </p>
      </div>
    );
  }

  const { tournament, group, players, matches } = data;
  const getPlayer = (id: number | null) => players.find(p => p.id === id) || null;
  const bestOf = (tournament.settings as any)?.groupBestOf || 3;
  const legsToWin = Math.ceil(bestOf / 2);

  const ptsWin = (tournament.settings as any)?.pointsForWin ?? 2;
  const ptsDraw = (tournament.settings as any)?.pointsForDraw ?? 1;
  const ptsLoss = (tournament.settings as any)?.pointsForLoss ?? 0;

  const completedMatches = matches.filter(m => m.status === 'COMPLETED');
  const pendingMatches = matches.filter(m => m.status === 'PENDING');
  const inProgressMatch = matches.find(m => m.status === 'IN_PROGRESS');

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
    return 0;
  });

  const handleTapMatch = (matchId: number) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    if (match.status === 'IN_PROGRESS') {
      setActiveMatchId(matchId);
      setLegScoreA(match.scoreA || 0);
      setLegScoreB(match.scoreB || 0);
      setView("scoring");
    } else if (match.status === 'PENDING') {
      startMatchMutation.mutate(matchId);
    }
  };

  const handleLegWon = (winner: 'A' | 'B') => {
    if (activeMatchId === null) return;
    const activeM = matches.find(m => m.id === activeMatchId);
    if (!activeM) return;

    const matchLegs = Math.ceil((activeM.bestOf || bestOf) / 2);
    const newScoreA = winner === 'A' ? legScoreA + 1 : legScoreA;
    const newScoreB = winner === 'B' ? legScoreB + 1 : legScoreB;

    setLegScoreA(newScoreA);
    setLegScoreB(newScoreB);

    if (newScoreA >= matchLegs || newScoreB >= matchLegs) {
      submitScoreMutation.mutate({ matchId: activeMatchId, scoreA: newScoreA, scoreB: newScoreB });
    } else {
      updateLegMutation.mutate({ matchId: activeMatchId, scoreA: newScoreA, scoreB: newScoreB });
    }
  };

  const handleUndoLeg = (side: 'A' | 'B') => {
    if (activeMatchId === null) return;
    const newA = side === 'A' ? Math.max(legScoreA - 1, 0) : legScoreA;
    const newB = side === 'B' ? Math.max(legScoreB - 1, 0) : legScoreB;
    setLegScoreA(newA);
    setLegScoreB(newB);
    updateLegMutation.mutate({ matchId: activeMatchId, scoreA: newA, scoreB: newB });
  };

  const activeMatch = activeMatchId ? matches.find(m => m.id === activeMatchId) : null;

  if (view === "scoring" && activeMatch) {
    const playerA = getPlayer(activeMatch.playerAId);
    const playerB = getPlayer(activeMatch.playerBId);
    const matchBestOf = activeMatch.bestOf || bestOf;
    const matchLegsToWin = Math.ceil(matchBestOf / 2);

    return (
      <div className="min-h-screen bg-background flex flex-col" data-testid="scorer-match-view">
        <div className="bg-primary text-primary-foreground py-4 px-4 shadow-lg">
          <div className="container max-w-3xl mx-auto flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground shrink-0"
              onClick={() => {
                setView("matchList");
                setActiveMatchId(null);
              }}
              data-testid="button-back-to-list"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-display font-bold truncate" data-testid="text-tournament-name">{tournament.name}</h1>
              <p className="text-primary-foreground/80 text-xs">
                {group.name} — Board {boardNumber} — Best of {matchBestOf}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Badge variant="outline" className="border-green-400 text-green-100 gap-1">
                  <Wifi className="w-3 h-3" /> Live
                </Badge>
              ) : (
                <Badge variant="outline" className="border-red-400 text-red-100 gap-1">
                  <WifiOff className="w-3 h-3" /> Offline
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col container max-w-3xl mx-auto px-4 py-6">
          <div className="text-center mb-2">
            <p className="text-sm text-muted-foreground uppercase tracking-wide font-medium">
              First to {matchLegsToWin} legs
            </p>
          </div>

          <div className="flex-1 grid grid-cols-3 gap-2 items-center min-h-0">
            <div className="flex flex-col items-center gap-4">
              <p className="text-lg md:text-xl font-bold text-center leading-tight" data-testid="text-player-a-name">
                {playerA?.name || "TBD"}
              </p>
              <div
                className="text-7xl md:text-8xl font-bold tabular-nums text-primary"
                data-testid="text-leg-score-a"
              >
                {legScoreA}
              </div>
              <Button
                className="w-full h-24 md:h-28 text-2xl font-bold touch-manipulation bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handleLegWon('A')}
                disabled={submitScoreMutation.isPending || updateLegMutation.isPending}
                data-testid="button-leg-won-a"
              >
                <Trophy className="w-6 h-6 mr-2" />
                Leg Won
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs touch-manipulation"
                onClick={() => handleUndoLeg('A')}
                disabled={legScoreA === 0 || submitScoreMutation.isPending || updateLegMutation.isPending}
                data-testid="button-undo-a"
              >
                <Minus className="w-3 h-3 mr-1" />
                Undo Leg
              </Button>
            </div>

            <div className="flex flex-col items-center justify-center">
              <span className="text-muted-foreground text-2xl font-bold">vs</span>
            </div>

            <div className="flex flex-col items-center gap-4">
              <p className="text-lg md:text-xl font-bold text-center leading-tight" data-testid="text-player-b-name">
                {playerB?.name || "TBD"}
              </p>
              <div
                className="text-7xl md:text-8xl font-bold tabular-nums text-primary"
                data-testid="text-leg-score-b"
              >
                {legScoreB}
              </div>
              <Button
                className="w-full h-24 md:h-28 text-2xl font-bold touch-manipulation bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handleLegWon('B')}
                disabled={submitScoreMutation.isPending || updateLegMutation.isPending}
                data-testid="button-leg-won-b"
              >
                <Trophy className="w-6 h-6 mr-2" />
                Leg Won
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs touch-manipulation"
                onClick={() => handleUndoLeg('B')}
                disabled={legScoreB === 0 || submitScoreMutation.isPending || updateLegMutation.isPending}
                data-testid="button-undo-b"
              >
                <Minus className="w-3 h-3 mr-1" />
                Undo Leg
              </Button>
            </div>
          </div>

          {(submitScoreMutation.isPending || updateLegMutation.isPending) && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
              <span className="text-sm text-muted-foreground">Updating...</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="scorer-view">
      <div className="bg-primary text-primary-foreground py-6 px-4 shadow-lg">
        <div className="container max-w-3xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Target className="w-6 h-6" />
                <h1 className="text-xl md:text-2xl font-display font-bold" data-testid="text-tournament-name">{tournament.name}</h1>
              </div>
              <p className="text-primary-foreground/80 text-sm">
                {group.name} — Board {boardNumber} Scorer
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Badge variant="outline" className="border-green-400 text-green-100 gap-1">
                  <Wifi className="w-3 h-3" /> Live
                </Badge>
              ) : (
                <Badge variant="outline" className="border-red-400 text-red-100 gap-1">
                  <WifiOff className="w-3 h-3" /> Offline
                </Badge>
              )}
              <Badge variant="outline" className="border-white/30 text-white px-3 py-1">
                Board {boardNumber}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-3xl mx-auto px-4 py-6 space-y-6">
        {inProgressMatch && (
          <Card
            className="border-2 border-green-500 shadow-xl cursor-pointer"
            onClick={() => handleTapMatch(inProgressMatch.id)}
            data-testid={`card-match-in-progress-${inProgressMatch.id}`}
          >
            <CardHeader className="bg-green-500/10 border-b pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                Now Playing
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 pb-4">
              <div className="flex items-center justify-between text-center mb-4">
                <div className="flex-1">
                  <p className="text-xl font-bold">{getPlayer(inProgressMatch.playerAId)?.name || "TBD"}</p>
                  <p className="text-3xl font-bold text-primary mt-2 tabular-nums">{inProgressMatch.scoreA || 0}</p>
                </div>
                <div className="text-muted-foreground text-sm uppercase font-medium px-4">vs</div>
                <div className="flex-1">
                  <p className="text-xl font-bold">{getPlayer(inProgressMatch.playerBId)?.name || "TBD"}</p>
                  <p className="text-3xl font-bold text-primary mt-2 tabular-nums">{inProgressMatch.scoreB || 0}</p>
                </div>
              </div>
              <p className="text-center text-sm text-muted-foreground mb-4">Best of {inProgressMatch.bestOf} (first to {legsToWin})</p>
              <Button
                className="w-full h-14 text-lg"
                data-testid="button-resume-scoring"
              >
                <Play className="w-5 h-5 mr-2" />
                Continue Scoring
              </Button>
            </CardContent>
          </Card>
        )}

        {!inProgressMatch && pendingMatches.length > 0 && (
          <Card className="border-2 border-primary shadow-xl" data-testid="card-next-up">
            <CardHeader className="bg-primary/10 border-b pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Play className="w-5 h-5 text-primary" />
                Next Up
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 pb-4">
              <div className="flex items-center justify-between text-center mb-4">
                <div className="flex-1">
                  <p className="text-xl font-bold">{getPlayer(pendingMatches[0].playerAId)?.name || "TBD"}</p>
                </div>
                <div className="text-muted-foreground text-sm uppercase font-medium px-4">vs</div>
                <div className="flex-1">
                  <p className="text-xl font-bold">{getPlayer(pendingMatches[0].playerBId)?.name || "TBD"}</p>
                </div>
              </div>
              <p className="text-center text-sm text-muted-foreground mb-4">Best of {pendingMatches[0].bestOf} (first to {legsToWin})</p>
              <Button
                className="w-full h-14 text-lg"
                onClick={() => handleTapMatch(pendingMatches[0].id)}
                disabled={startMatchMutation.isPending}
                data-testid="button-start-next-match"
              >
                {startMatchMutation.isPending ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Target className="w-5 h-5 mr-2" />
                )}
                Start Match
              </Button>
            </CardContent>
          </Card>
        )}

        {pendingMatches.length === 0 && !inProgressMatch && (
          <Card className="border-2 border-dashed" data-testid="card-all-done">
            <CardContent className="py-12 text-center">
              <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">All Matches Complete!</h2>
              <p className="text-muted-foreground">All matches on this board have been played.</p>
            </CardContent>
          </Card>
        )}

        {pendingMatches.length > 1 && (
          <Card data-testid="card-upcoming-matches">
            <CardHeader>
              <CardTitle className="text-lg">Upcoming Matches</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {pendingMatches.slice(1).map((match) => (
                  <button
                    key={match.id}
                    className="flex items-center justify-between p-4 w-full text-left hover:bg-muted/50 transition-colors touch-manipulation"
                    onClick={() => handleTapMatch(match.id)}
                    disabled={!!inProgressMatch || startMatchMutation.isPending}
                    data-testid={`button-upcoming-match-${match.id}`}
                  >
                    <span className="font-medium">{getPlayer(match.playerAId)?.name || "TBD"}</span>
                    <span className="text-muted-foreground text-sm">vs</span>
                    <span className="font-medium">{getPlayer(match.playerBId)?.name || "TBD"}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground ml-2 shrink-0" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-t-4 border-t-primary" data-testid="card-standings">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="w-5 h-5 text-yellow-500" />
              {group.name} Standings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">#</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-center">P</TableHead>
                  <TableHead className="text-center">W</TableHead>
                  <TableHead className="text-center">L</TableHead>
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
                {completedMatches.map(match => {
                  const playerA = getPlayer(match.playerAId);
                  const playerB = getPlayer(match.playerBId);
                  return (
                    <div key={match.id} className="flex items-center justify-between p-4">
                      <div className={cn("flex-1 text-right font-medium", match.winnerId === match.playerAId && "text-primary font-bold")}>
                        {playerA?.name || "TBD"}
                      </div>
                      <div className="flex items-center gap-3 px-6">
                        <span className={cn("text-xl font-bold", (match.scoreA || 0) > (match.scoreB || 0) ? "text-primary" : "text-muted-foreground")}>
                          {match.scoreA || 0}
                        </span>
                        <span className="text-muted-foreground text-xs">-</span>
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
