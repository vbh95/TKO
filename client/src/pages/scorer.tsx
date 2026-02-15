import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Target, Trophy, Wifi, WifiOff, Play, ChevronRight, ArrowLeft, Undo2, RotateCcw } from "lucide-react";
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

type Visit = { player: 'A' | 'B'; score: number };

type ScorerView = "matchList" | "scoring";

const STARTING_SCORE = 501;

const QUICK_SCORES = [26, 41, 45, 60, 85, 100, 140, 180];

export default function ScorerPage() {
  const params = useParams<{ tournamentId: string; boardNumber: string }>();
  const tournamentId = parseInt(params.tournamentId || "0");
  const boardNumber = parseInt(params.boardNumber || "0");
  const { toast } = useToast();
  const { joinScorer, joinBoard, on, socket } = useSocket();
  const [isConnected, setIsConnected] = useState(false);
  const [view, setView] = useState<ScorerView>("matchList");
  const [activeMatchId, setActiveMatchId] = useState<number | null>(null);

  const [legsWonA, setLegsWonA] = useState(0);
  const [legsWonB, setLegsWonB] = useState(0);

  const [remainingA, setRemainingA] = useState(STARTING_SCORE);
  const [remainingB, setRemainingB] = useState(STARTING_SCORE);
  const [currentThrower, setCurrentThrower] = useState<'A' | 'B'>('A');
  const [legVisits, setLegVisits] = useState<Visit[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [bustMessage, setBustMessage] = useState<string | null>(null);
  const [legStartingThrower, setLegStartingThrower] = useState<'A' | 'B'>('A');

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
        const totalLegs = (inProgress.scoreA || 0) + (inProgress.scoreB || 0);
        const starter: 'A' | 'B' = totalLegs % 2 === 0 ? 'A' : 'B';
        setActiveMatchId(inProgress.id);
        setLegsWonA(inProgress.scoreA || 0);
        setLegsWonB(inProgress.scoreB || 0);
        resetLeg(starter);
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
      setLegsWonA(0);
      setLegsWonB(0);
      resetLeg('A');
      setView("scoring");
      refetch();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateScoreMutation = useMutation({
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
    onSuccess: (updatedMatch) => {
      if (updatedMatch.status === 'COMPLETED') {
        toast({ title: "Match complete!" });
        setActiveMatchId(null);
        setView("matchList");
      }
      refetch();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const emitLiveScoringMutation = useMutation({
    mutationFn: async (scoringData: any) => {
      if (!activeMatchId) return;
      const res = await fetch(`/api/scorer/matches/${activeMatchId}/leg-scoring`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(scoringData),
      });
      if (!res.ok) throw new Error("Failed to emit scoring");
      return res.json();
    },
  });

  const resetLeg = (startingThrower: 'A' | 'B') => {
    setRemainingA(STARTING_SCORE);
    setRemainingB(STARTING_SCORE);
    setCurrentThrower(startingThrower);
    setLegStartingThrower(startingThrower);
    setLegVisits([]);
    setInputValue("");
    setBustMessage(null);
  };

  const emitLiveState = useCallback((rA: number, rB: number, thrower: 'A' | 'B', lA: number, lB: number) => {
    emitLiveScoringMutation.mutate({
      remainingA: rA,
      remainingB: rB,
      currentThrower: thrower,
      legsWonA: lA,
      legsWonB: lB,
    });
  }, [activeMatchId]);

  const handleScoreSubmit = (score: number) => {
    if (activeMatchId === null) return;
    const activeM = data?.matches.find(m => m.id === activeMatchId);
    if (!activeM) return;

    const matchBestOf = activeM.bestOf || 3;
    const matchLegsToWin = Math.ceil(matchBestOf / 2);

    const isPlayerA = currentThrower === 'A';
    const currentRemaining = isPlayerA ? remainingA : remainingB;
    const newRemaining = currentRemaining - score;

    if (newRemaining < 0 || newRemaining === 1) {
      setBustMessage(`BUST! ${score} scored, stays on ${currentRemaining}`);
      setTimeout(() => setBustMessage(null), 2000);
      const nextThrower = currentThrower === 'A' ? 'B' : 'A';
      setCurrentThrower(nextThrower);
      setLegVisits(prev => [...prev, { player: currentThrower, score: 0 }]);
      setInputValue("");
      emitLiveState(remainingA, remainingB, nextThrower, legsWonA, legsWonB);
      return;
    }

    const newVisits = [...legVisits, { player: currentThrower, score }];
    setLegVisits(newVisits);
    setInputValue("");

    if (newRemaining === 0) {
      const newLegsA = isPlayerA ? legsWonA + 1 : legsWonA;
      const newLegsB = !isPlayerA ? legsWonB + 1 : legsWonB;
      setLegsWonA(newLegsA);
      setLegsWonB(newLegsB);

      if (isPlayerA) {
        setRemainingA(0);
      } else {
        setRemainingB(0);
      }

      emitLiveState(
        isPlayerA ? 0 : remainingA,
        !isPlayerA ? 0 : remainingB,
        currentThrower,
        newLegsA,
        newLegsB,
      );

      updateScoreMutation.mutate({
        matchId: activeMatchId,
        scoreA: newLegsA,
        scoreB: newLegsB,
      });

      if (newLegsA < matchLegsToWin && newLegsB < matchLegsToWin) {
        const playerName = isPlayerA
          ? data?.players.find(p => p.id === activeM.playerAId)?.name
          : data?.players.find(p => p.id === activeM.playerBId)?.name;
        toast({ title: `Leg won by ${playerName || 'Player'}!` });

        const nextStarter = legStartingThrower === 'A' ? 'B' : 'A';
        setTimeout(() => resetLeg(nextStarter), 1500);
      }

      return;
    }

    if (isPlayerA) {
      setRemainingA(newRemaining);
    } else {
      setRemainingB(newRemaining);
    }

    const nextThrower = currentThrower === 'A' ? 'B' : 'A';
    setCurrentThrower(nextThrower);
    setBustMessage(null);

    emitLiveState(
      isPlayerA ? newRemaining : remainingA,
      !isPlayerA ? newRemaining : remainingB,
      nextThrower,
      legsWonA,
      legsWonB,
    );
  };

  const handleUndo = () => {
    if (legVisits.length === 0 || updateScoreMutation.isPending) return;
    const lastVisit = legVisits[legVisits.length - 1];
    const newVisits = legVisits.slice(0, -1);
    setLegVisits(newVisits);

    if (lastVisit.player === 'A') {
      const newR = remainingA + lastVisit.score;
      setRemainingA(newR);
      setCurrentThrower('A');
      emitLiveState(newR, remainingB, 'A', legsWonA, legsWonB);
    } else {
      const newR = remainingB + lastVisit.score;
      setRemainingB(newR);
      setCurrentThrower('B');
      emitLiveState(remainingA, newR, 'B', legsWonA, legsWonB);
    }

    setBustMessage(null);
    setInputValue("");
  };

  const handleNumpad = (digit: string) => {
    if (digit === 'C') {
      setInputValue("");
      return;
    }
    if (digit === 'OK') {
      const score = parseInt(inputValue);
      if (isNaN(score) || score < 0 || score > 180) {
        setBustMessage("Invalid score (0-180)");
        setTimeout(() => setBustMessage(null), 1500);
        return;
      }
      handleScoreSubmit(score);
      return;
    }
    const newVal = inputValue + digit;
    if (parseInt(newVal) > 180) return;
    setInputValue(newVal);
  };

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
      const totalLegs = (match.scoreA || 0) + (match.scoreB || 0);
      const starter: 'A' | 'B' = totalLegs % 2 === 0 ? 'A' : 'B';
      setActiveMatchId(matchId);
      setLegsWonA(match.scoreA || 0);
      setLegsWonB(match.scoreB || 0);
      resetLeg(starter);
      setView("scoring");
    } else if (match.status === 'PENDING') {
      startMatchMutation.mutate(matchId);
    }
  };

  const activeMatch = activeMatchId ? matches.find(m => m.id === activeMatchId) : null;

  if (view === "scoring" && activeMatch) {
    const playerA = getPlayer(activeMatch.playerAId);
    const playerB = getPlayer(activeMatch.playerBId);
    const matchBestOf = activeMatch.bestOf || bestOf;
    const matchLegsToWin = Math.ceil(matchBestOf / 2);

    return (
      <div className="min-h-screen bg-background flex flex-col overflow-hidden" data-testid="scorer-match-view">
        <div className="bg-primary text-primary-foreground py-2 px-3 shadow-lg shrink-0">
          <div className="flex items-center gap-2 max-w-4xl mx-auto">
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground shrink-0 h-8 w-8"
              onClick={() => {
                setView("matchList");
                setActiveMatchId(null);
              }}
              data-testid="button-back-to-list"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-primary-foreground/80 truncate">
                {tournament.name} — {group.name} — Board {boardNumber}
              </p>
            </div>
            {isConnected ? (
              <Badge variant="outline" className="border-green-400 text-green-100 gap-1 text-xs py-0">
                <Wifi className="w-3 h-3" /> Live
              </Badge>
            ) : (
              <Badge variant="outline" className="border-red-400 text-red-100 gap-1 text-xs py-0">
                <WifiOff className="w-3 h-3" /> Off
              </Badge>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-3 py-2 overflow-hidden">
          <div className="grid grid-cols-3 gap-1 mb-2 shrink-0">
            <div
              className={cn(
                "text-center p-3 rounded-lg transition-colors",
                currentThrower === 'A' ? "bg-primary/10 ring-2 ring-primary" : "bg-muted/30"
              )}
              data-testid="panel-player-a"
            >
              <p className="text-sm font-bold truncate mb-1" data-testid="text-player-a-name">
                {playerA?.name || "Player A"}
              </p>
              <div
                className={cn(
                  "text-4xl md:text-5xl font-bold tabular-nums",
                  remainingA <= 40 ? "text-red-500" : "text-foreground"
                )}
                data-testid="text-remaining-a"
              >
                {remainingA}
              </div>
              <div className="mt-1 flex items-center justify-center gap-1">
                <span className="text-xs text-muted-foreground">Legs:</span>
                <span className="text-lg font-bold text-primary tabular-nums" data-testid="text-legs-a">{legsWonA}</span>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center">
              <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">
                Best of {matchBestOf}
              </p>
              <div className="text-2xl font-bold tabular-nums">
                <span className={legsWonA > legsWonB ? "text-primary" : "text-muted-foreground"}>{legsWonA}</span>
                <span className="text-muted-foreground mx-1">-</span>
                <span className={legsWonB > legsWonA ? "text-primary" : "text-muted-foreground"}>{legsWonB}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                First to {matchLegsToWin}
              </p>
            </div>

            <div
              className={cn(
                "text-center p-3 rounded-lg transition-colors",
                currentThrower === 'B' ? "bg-primary/10 ring-2 ring-primary" : "bg-muted/30"
              )}
              data-testid="panel-player-b"
            >
              <p className="text-sm font-bold truncate mb-1" data-testid="text-player-b-name">
                {playerB?.name || "Player B"}
              </p>
              <div
                className={cn(
                  "text-4xl md:text-5xl font-bold tabular-nums",
                  remainingB <= 40 ? "text-red-500" : "text-foreground"
                )}
                data-testid="text-remaining-b"
              >
                {remainingB}
              </div>
              <div className="mt-1 flex items-center justify-center gap-1">
                <span className="text-xs text-muted-foreground">Legs:</span>
                <span className="text-lg font-bold text-primary tabular-nums" data-testid="text-legs-b">{legsWonB}</span>
              </div>
            </div>
          </div>

          {bustMessage && (
            <div className="bg-red-500 text-white text-center py-2 rounded-lg mb-2 text-sm font-bold animate-pulse shrink-0" data-testid="text-bust">
              {bustMessage}
            </div>
          )}

          <div className="bg-muted/50 rounded-lg p-3 mb-2 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {currentThrower === 'A' ? (playerA?.name || "Player A") : (playerB?.name || "Player B")} to throw
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={handleUndo}
                  disabled={legVisits.length === 0 || updateScoreMutation.isPending}
                  data-testid="button-undo"
                >
                  <Undo2 className="w-3 h-3 mr-1" />
                  Undo
                </Button>
              </div>
            </div>

            <div className="flex gap-2 items-center mb-3">
              <div
                className="flex-1 bg-background border-2 border-primary rounded-lg px-4 py-3 text-center text-3xl font-bold tabular-nums min-h-[52px] flex items-center justify-center"
                data-testid="text-input-value"
              >
                {inputValue || <span className="text-muted-foreground/30">0</span>}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1 mb-2">
              {QUICK_SCORES.map(qs => (
                <Button
                  key={qs}
                  variant="outline"
                  className={cn(
                    "h-10 text-sm font-bold touch-manipulation",
                    qs === 180 && "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400 text-yellow-700 dark:text-yellow-300"
                  )}
                  onClick={() => handleScoreSubmit(qs)}
                  disabled={updateScoreMutation.isPending}
                  data-testid={`button-quick-${qs}`}
                >
                  {qs}
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'].map(key => (
                <Button
                  key={key}
                  variant={key === 'OK' ? 'default' : key === 'C' ? 'secondary' : 'outline'}
                  className={cn(
                    "h-12 text-lg font-bold touch-manipulation",
                    key === 'OK' && "bg-green-600 hover:bg-green-700 text-white",
                    key === 'C' && "text-red-500"
                  )}
                  onClick={() => handleNumpad(key)}
                  disabled={
                    (key === 'OK' && inputValue === '') ||
                    updateScoreMutation.isPending
                  }
                  data-testid={`button-numpad-${key}`}
                >
                  {key}
                </Button>
              ))}
            </div>

            <Button
              variant="outline"
              className="w-full mt-2 h-10 text-sm touch-manipulation"
              onClick={() => handleScoreSubmit(0)}
              disabled={updateScoreMutation.isPending}
              data-testid="button-no-score"
            >
              No Score (0)
            </Button>
          </div>

          {legVisits.length > 0 && (
            <div className="shrink-0 overflow-auto max-h-24 bg-muted/30 rounded-lg px-3 py-2">
              <p className="text-[10px] uppercase text-muted-foreground font-medium mb-1">Visit History</p>
              <div className="flex flex-wrap gap-1">
                {legVisits.map((v, i) => (
                  <span
                    key={i}
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full font-medium",
                      v.player === 'A'
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
                      v.score === 0 && "opacity-50"
                    )}
                    data-testid={`visit-${i}`}
                  >
                    {v.player === 'A' ? (playerA?.name?.charAt(0) || 'A') : (playerB?.name?.charAt(0) || 'B')}: {v.score}
                  </span>
                ))}
              </div>
            </div>
          )}

          {updateScoreMutation.isPending && (
            <div className="flex items-center justify-center py-2 shrink-0">
              <Loader2 className="w-4 h-4 animate-spin text-primary mr-2" />
              <span className="text-xs text-muted-foreground">Updating...</span>
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
                  const pA = getPlayer(match.playerAId);
                  const pB = getPlayer(match.playerBId);
                  return (
                    <div key={match.id} className="flex items-center justify-between p-4">
                      <div className={cn("flex-1 text-right font-medium", match.winnerId === match.playerAId && "text-primary font-bold")}>
                        {pA?.name || "TBD"}
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
                        {pB?.name || "TBD"}
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
