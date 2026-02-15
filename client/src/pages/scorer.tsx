import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Target, Trophy, Wifi, WifiOff, Play, ChevronRight, ArrowLeft, Undo2, RotateCcw, Check, Eye, Grid2x2, Delete, Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
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

interface MatchStats {
  totalVisitsA: number;
  totalVisitsB: number;
  totalScoredA: number;
  totalScoredB: number;
  highestVisitA: number;
  highestVisitB: number;
  highestFinishA: number;
  highestFinishB: number;
  ton80sA: number;
  ton80sB: number;
  ton40sA: number;
  ton40sB: number;
  tonsA: number;
  tonsB: number;
  legsWonA: number;
  legsWonB: number;
  checkoutAttemptsA: number;
  checkoutAttemptsB: number;
  checkoutSuccessA: number;
  checkoutSuccessB: number;
  playerAName: string;
  playerBName: string;
  winnerId: number | null;
  playerAId: number | null;
  playerBId: number | null;
}

type ScorerView = "matchList" | "bullThrow" | "scoring" | "matchReport";

const STARTING_SCORE = 501;

const QUICK_SCORES = [26, 41, 45, 60, 85, 100, 140, 180];

const IMPOSSIBLE_SCORES = new Set([163, 166, 169, 172, 173, 175, 176, 178, 179]);

export default function ScorerPage() {
  const params = useParams<{ tournamentId: string; boardNumber: string }>();
  const tournamentId = parseInt(params.tournamentId || "0");
  const boardNumber = parseInt(params.boardNumber || "0");
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
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
  const [showQuickScores, setShowQuickScores] = useState(false);
  const [allMatchVisits, setAllMatchVisits] = useState<Visit[]>([]);
  const [matchReport, setMatchReport] = useState<MatchStats | null>(null);
  const [pendingCheckout, setPendingCheckout] = useState<{ player: 'A' | 'B'; newLegsA: number; newLegsB: number; newVisits: Visit[]; checkoutScore: number } | null>(null);
  const [pendingDartsAtDouble, setPendingDartsAtDouble] = useState(false);
  const [impossibleWarning, setImpossibleWarning] = useState<string | null>(null);
  const [checkoutAttemptsA, setCheckoutAttemptsA] = useState(0);
  const [checkoutAttemptsB, setCheckoutAttemptsB] = useState(0);
  const [checkoutSuccessA, setCheckoutSuccessA] = useState(0);
  const [checkoutSuccessB, setCheckoutSuccessB] = useState(0);
  const [highestFinishA, setHighestFinishA] = useState(0);
  const [highestFinishB, setHighestFinishB] = useState(0);
  const checkoutStatsRef = useRef({ attemptsA: 0, attemptsB: 0, successA: 0, successB: 0, finishA: 0, finishB: 0 });
  const [swapPlayers, setSwapPlayers] = useState(false);

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
        setAllMatchVisits([]);
        setCheckoutAttemptsA(0);
        setCheckoutAttemptsB(0);
        setCheckoutSuccessA(0);
        setCheckoutSuccessB(0);
        setHighestFinishA(0);
        setHighestFinishB(0);
        checkoutStatsRef.current = { attemptsA: 0, attemptsB: 0, successA: 0, successB: 0, finishA: 0, finishB: 0 };
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
      setAllMatchVisits([]);
      setCheckoutAttemptsA(0);
      setCheckoutAttemptsB(0);
      setCheckoutSuccessA(0);
      setCheckoutSuccessB(0);
      setHighestFinishA(0);
      setHighestFinishB(0);
      checkoutStatsRef.current = { attemptsA: 0, attemptsB: 0, successA: 0, successB: 0, finishA: 0, finishB: 0 };
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
        const vA = allMatchVisits.filter(v => v.player === 'A');
        const vB = allMatchVisits.filter(v => v.player === 'B');
        const pA = data?.players.find(p => p.id === updatedMatch.playerAId);
        const pB = data?.players.find(p => p.id === updatedMatch.playerBId);
        const cs = checkoutStatsRef.current;
        setMatchReport({
          totalVisitsA: vA.length,
          totalVisitsB: vB.length,
          totalScoredA: vA.reduce((s: number, v: Visit) => s + v.score, 0),
          totalScoredB: vB.reduce((s: number, v: Visit) => s + v.score, 0),
          highestVisitA: vA.length > 0 ? Math.max(...vA.map(v => v.score)) : 0,
          highestVisitB: vB.length > 0 ? Math.max(...vB.map(v => v.score)) : 0,
          highestFinishA: cs.finishA,
          highestFinishB: cs.finishB,
          ton80sA: vA.filter(v => v.score === 180).length,
          ton80sB: vB.filter(v => v.score === 180).length,
          ton40sA: vA.filter(v => v.score >= 140 && v.score < 180).length,
          ton40sB: vB.filter(v => v.score >= 140 && v.score < 180).length,
          tonsA: vA.filter(v => v.score >= 100 && v.score < 140).length,
          tonsB: vB.filter(v => v.score >= 100 && v.score < 140).length,
          legsWonA: updatedMatch.scoreA || 0,
          legsWonB: updatedMatch.scoreB || 0,
          checkoutAttemptsA: cs.attemptsA,
          checkoutAttemptsB: cs.attemptsB,
          checkoutSuccessA: cs.successA,
          checkoutSuccessB: cs.successB,
          playerAName: pA?.name || 'Player 1',
          playerBName: pB?.name || 'Player 2',
          winnerId: updatedMatch.winnerId,
          playerAId: updatedMatch.playerAId,
          playerBId: updatedMatch.playerBId,
        });
        setActiveMatchId(null);
        setView("matchReport");
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

  const emitLiveState = useCallback((rA: number, rB: number, thrower: 'A' | 'B', lA: number, lB: number, visits?: Visit[]) => {
    const activeM = data?.matches.find(m => m.id === activeMatchId);
    const pA = activeM ? data?.players.find(p => p.id === activeM.playerAId) : null;
    const pB = activeM ? data?.players.find(p => p.id === activeM.playerBId) : null;
    const v = visits || legVisits;
    const vA = v.filter(vi => vi.player === 'A');
    const vB = v.filter(vi => vi.player === 'B');
    emitLiveScoringMutation.mutate({
      remainingA: rA,
      remainingB: rB,
      currentThrower: thrower,
      legsWonA: lA,
      legsWonB: lB,
      playerAName: pA?.name || 'Player 1',
      playerBName: pB?.name || 'Player 2',
      bestOf: activeM?.bestOf || 3,
      avgA: vA.length > 0 ? (vA.reduce((s, vi) => s + vi.score, 0) / vA.length).toFixed(2) : '0.00',
      avgB: vB.length > 0 ? (vB.reduce((s, vi) => s + vi.score, 0) / vB.length).toFixed(2) : '0.00',
      dartsA: vA.length * 3,
      dartsB: vB.length * 3,
      lastScoreA: vA.length > 0 ? vA[vA.length - 1].score : null,
      lastScoreB: vB.length > 0 ? vB[vB.length - 1].score : null,
    });
  }, [activeMatchId, data, legVisits]);

  const handleScoreSubmit = (score: number) => {
    if (activeMatchId === null) return;
    const activeM = data?.matches.find(m => m.id === activeMatchId);
    if (!activeM) return;

    if (score > 180 || IMPOSSIBLE_SCORES.has(score)) {
      const msg = score > 180
        ? `${score} is impossible — max score is 180`
        : `${score} is impossible — cannot be scored with 3 darts`;
      setImpossibleWarning(msg);
      return;
    }

    const matchBestOf = activeM.bestOf || 3;
    const matchLegsToWin = Math.ceil(matchBestOf / 2);

    const isPlayerA = currentThrower === 'A';
    const currentRemaining = isPlayerA ? remainingA : remainingB;
    const newRemaining = currentRemaining - score;

    if (newRemaining < 0 || newRemaining === 1) {
      setBustMessage(`BUST! Stays on ${currentRemaining}`);
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

      if (isPlayerA) {
        setRemainingA(0);
      } else {
        setRemainingB(0);
      }

      setPendingCheckout({ player: currentThrower, newLegsA, newLegsB, newVisits, checkoutScore: score });
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

  const handleConfirmCheckoutClick = () => {
    setPendingDartsAtDouble(true);
  };

  const confirmCheckout = (dartsAtDouble: number) => {
    if (!pendingCheckout || !activeMatchId) return;
    setPendingDartsAtDouble(false);
    const { player, newLegsA, newLegsB, newVisits, checkoutScore } = pendingCheckout;

    if (player === 'A') {
      checkoutStatsRef.current.attemptsA += dartsAtDouble;
      checkoutStatsRef.current.successA += 1;
      checkoutStatsRef.current.finishA = Math.max(checkoutStatsRef.current.finishA, checkoutScore);
      setCheckoutAttemptsA(checkoutStatsRef.current.attemptsA);
      setCheckoutSuccessA(checkoutStatsRef.current.successA);
      setHighestFinishA(checkoutStatsRef.current.finishA);
    } else {
      checkoutStatsRef.current.attemptsB += dartsAtDouble;
      checkoutStatsRef.current.successB += 1;
      checkoutStatsRef.current.finishB = Math.max(checkoutStatsRef.current.finishB, checkoutScore);
      setCheckoutAttemptsB(checkoutStatsRef.current.attemptsB);
      setCheckoutSuccessB(checkoutStatsRef.current.successB);
      setHighestFinishB(checkoutStatsRef.current.finishB);
    }
    const activeM = data?.matches.find(m => m.id === activeMatchId);
    if (!activeM) return;
    const matchBestOf = activeM.bestOf || 3;
    const matchLegsToWin = Math.ceil(matchBestOf / 2);
    const isPlayerA = player === 'A';

    setLegsWonA(newLegsA);
    setLegsWonB(newLegsB);

    emitLiveState(
      isPlayerA ? 0 : remainingA,
      !isPlayerA ? 0 : remainingB,
      player,
      newLegsA,
      newLegsB,
    );

    updateScoreMutation.mutate({
      matchId: activeMatchId,
      scoreA: newLegsA,
      scoreB: newLegsB,
    });

    setAllMatchVisits(prev => [...prev, ...newVisits]);

    if (newLegsA < matchLegsToWin && newLegsB < matchLegsToWin) {
      const playerName = isPlayerA
        ? data?.players.find(p => p.id === activeM.playerAId)?.name
        : data?.players.find(p => p.id === activeM.playerBId)?.name;
      toast({ title: `Leg won by ${playerName || 'Player'}!` });

      const nextStarter = legStartingThrower === 'A' ? 'B' : 'A';
      setTimeout(() => resetLeg(nextStarter), 1500);
    }

    setPendingCheckout(null);
  };

  const cancelCheckout = () => {
    if (!pendingCheckout) return;
    const lastVisit = legVisits[legVisits.length - 1];
    if (lastVisit) {
      const restored = legVisits.slice(0, -1);
      setLegVisits(restored);
      if (lastVisit.player === 'A') {
        setRemainingA(remainingA + lastVisit.score);
      } else {
        setRemainingB(remainingB + lastVisit.score);
      }
    }
    setPendingCheckout(null);
    setPendingDartsAtDouble(false);
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
      if (inputValue === "") {
        handleScoreSubmit(0);
        return;
      }
      const score = parseInt(inputValue);
      if (isNaN(score) || score < 0) {
        setBustMessage("Invalid score");
        setTimeout(() => setBustMessage(null), 1500);
        return;
      }
      handleScoreSubmit(score);
      return;
    }
    const newVal = inputValue + digit;
    if (newVal.length > 3) return;
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
  const ptsLoss = (tournament.settings as any)?.pointsForLoss ?? 0;

  const completedMatches = matches.filter(m => m.status === 'COMPLETED');
  const pendingMatches = matches.filter(m => m.status === 'PENDING');
  const inProgressMatch = matches.find(m => m.status === 'IN_PROGRESS');

  const standings = players.map(player => {
    const playerMatches = completedMatches.filter(m =>
      m.playerAId === player.id || m.playerBId === player.id
    );
    let played = 0, won = 0, lost = 0, legsFor = 0, legsAgainst = 0;
    playerMatches.forEach(m => {
      played++;
      const isA = m.playerAId === player.id;
      const myScore = isA ? (m.scoreA || 0) : (m.scoreB || 0);
      const oppScore = isA ? (m.scoreB || 0) : (m.scoreA || 0);
      legsFor += myScore;
      legsAgainst += oppScore;
      if (m.winnerId === player.id) won++;
      else lost++;
    });
    return {
      ...player, played, won, lost, legsFor, legsAgainst,
      diff: legsFor - legsAgainst,
      pts: (won * ptsWin) + (lost * ptsLoss)
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
      setAllMatchVisits([]);
      setCheckoutAttemptsA(0);
      setCheckoutAttemptsB(0);
      setCheckoutSuccessA(0);
      setCheckoutSuccessB(0);
      setHighestFinishA(0);
      setHighestFinishB(0);
      checkoutStatsRef.current = { attemptsA: 0, attemptsB: 0, successA: 0, successB: 0, finishA: 0, finishB: 0 };
      setSwapPlayers(false);
      resetLeg(starter);
      setView("scoring");
    } else if (match.status === 'PENDING') {
      setActiveMatchId(matchId);
      setView("bullThrow");
    }
  };

  const activeMatch = activeMatchId ? matches.find(m => m.id === activeMatchId) : null;

  if (view === "bullThrow" && activeMatch) {
    const playerA = getPlayer(activeMatch.playerAId);
    const playerB = getPlayer(activeMatch.playerBId);
    const matchBestOf = activeMatch.bestOf || bestOf;

    const handleFirstThrower = (thrower: 'A' | 'B') => {
      const applyThrower = () => {
        setLegsWonA(activeMatch.scoreA || 0);
        setLegsWonB(activeMatch.scoreB || 0);
        setAllMatchVisits([]);
        setCheckoutAttemptsA(0);
        setCheckoutAttemptsB(0);
        setCheckoutSuccessA(0);
        setCheckoutSuccessB(0);
        setHighestFinishA(0);
        setHighestFinishB(0);
        checkoutStatsRef.current = { attemptsA: 0, attemptsB: 0, successA: 0, successB: 0, finishA: 0, finishB: 0 };
        resetLeg(thrower);
        setLegStartingThrower(thrower);
        setSwapPlayers(thrower === 'B');
        setView("scoring");
      };

      if (activeMatch.status === 'IN_PROGRESS') {
        applyThrower();
      } else {
        startMatchMutation.mutate(activeMatch.id, {
          onSuccess: () => {
            applyThrower();
            refetch();
          }
        });
      }
    };

    return (
      <div className="min-h-[100dvh] bg-[#1a1a1a] flex flex-col" data-testid="scorer-bull-throw">
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
              data-testid="button-back-from-bull"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-primary-foreground/80 truncate">
                {tournament.name} — {group.name} — Board {boardNumber}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <Target className="w-14 h-14 text-yellow-400 mb-4" />
          <h2 className="text-white text-2xl font-bold mb-1">Throw for the Bull</h2>
          <p className="text-gray-400 text-sm mb-8">Select player to start</p>

          <div className="w-full max-w-sm space-y-3">
            <button
              className="w-full h-16 rounded-xl bg-[#3a6635] border border-[#4a8045] text-white text-lg font-bold touch-manipulation active:bg-[#4a7a3a] transition-colors"
              onClick={() => handleFirstThrower('A')}
              disabled={startMatchMutation.isPending}
              data-testid="button-first-thrower-a"
            >
              {playerA?.name || 'Player 1'}
            </button>

            <p className="text-gray-500 text-center text-sm font-medium">vs</p>

            <button
              className="w-full h-16 rounded-xl bg-[#3a6635] border border-[#4a8045] text-white text-lg font-bold touch-manipulation active:bg-[#4a7a3a] transition-colors"
              onClick={() => handleFirstThrower('B')}
              disabled={startMatchMutation.isPending}
              data-testid="button-first-thrower-b"
            >
              {playerB?.name || 'Player 2'}
            </button>
          </div>

          {startMatchMutation.isPending && (
            <div className="mt-4">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === "scoring" && activeMatch) {
    const playerA = getPlayer(activeMatch.playerAId);
    const playerB = getPlayer(activeMatch.playerBId);
    const matchBestOf = activeMatch.bestOf || bestOf;
    const matchLegsToWin = Math.ceil(matchBestOf / 2);
    const currentLeg = legsWonA + legsWonB + 1;

    const visitsA = legVisits.filter(v => v.player === 'A');
    const visitsB = legVisits.filter(v => v.player === 'B');
    const dartsA = visitsA.length * 3;
    const dartsB = visitsB.length * 3;
    const totalScoreA = visitsA.reduce((s, v) => s + v.score, 0);
    const totalScoreB = visitsB.reduce((s, v) => s + v.score, 0);
    const avgA = dartsA > 0 ? (totalScoreA / visitsA.length).toFixed(2) : '0.00';
    const avgB = dartsB > 0 ? (totalScoreB / visitsB.length).toFixed(2) : '0.00';
    const lastScoreA = visitsA.length > 0 ? visitsA[visitsA.length - 1].score : null;
    const lastScoreB = visitsB.length > 0 ? visitsB[visitsB.length - 1].score : null;

    const leftPlayer = swapPlayers ? playerB : playerA;
    const rightPlayer = swapPlayers ? playerA : playerB;
    const leftThrower: 'A' | 'B' = swapPlayers ? 'B' : 'A';
    const rightThrower: 'A' | 'B' = swapPlayers ? 'A' : 'B';
    const leftRemaining = swapPlayers ? remainingB : remainingA;
    const rightRemaining = swapPlayers ? remainingA : remainingB;
    const leftLegs = swapPlayers ? legsWonB : legsWonA;
    const rightLegs = swapPlayers ? legsWonA : legsWonB;
    const leftAvg = swapPlayers ? avgB : avgA;
    const rightAvg = swapPlayers ? avgA : avgB;
    const leftDarts = swapPlayers ? dartsB : dartsA;
    const rightDarts = swapPlayers ? dartsA : dartsB;
    const leftLastScore = swapPlayers ? lastScoreB : lastScoreA;
    const rightLastScore = swapPlayers ? lastScoreA : lastScoreB;

    return (
      <div className="min-h-[100dvh] bg-[#1a1a1a] flex flex-col overflow-hidden" data-testid="scorer-match-view">
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
            <button
              onClick={toggleTheme}
              className="p-1 rounded hover:bg-white/10 transition-colors"
              data-testid="button-toggle-theme-scorer"
            >
              {theme === "light" ? <Moon className="w-3.5 h-3.5 text-primary-foreground" /> : <Sun className="w-3.5 h-3.5 text-primary-foreground" />}
            </button>
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

        <div className="flex-1 flex flex-col w-full max-w-lg mx-auto px-3 py-1 overflow-hidden">
          {legVisits.length === 0 && legsWonA === 0 && legsWonB === 0 && (
            <div className="flex justify-center mb-1 shrink-0">
              <button
                className="flex items-center gap-1 text-gray-400 text-xs px-3 py-1 rounded-lg bg-[#2a2a2a] border border-[#3a3a3a] touch-manipulation active:bg-[#3a3a3a] transition-colors"
                onClick={() => setView("bullThrow")}
                data-testid="button-back-to-bull"
              >
                <ArrowLeft className="w-3 h-3" />
                Bull Throw
              </button>
            </div>
          )}
          <div className="text-center py-1 shrink-0">
            <p className="text-gray-400 text-xs uppercase tracking-wider">
              Leg {currentLeg} — Best of {matchBestOf}
            </p>
            <div className="tabular-nums mt-0.5">
              <span className={cn("text-3xl font-bold", leftLegs >= rightLegs ? "text-white" : "text-gray-500")}>{leftLegs}</span>
              <span className="text-gray-600 mx-2 text-2xl">-</span>
              <span className={cn("text-3xl font-bold", rightLegs >= leftLegs ? "text-white" : "text-gray-500")}>{rightLegs}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2 shrink-0">
            <div
              className={cn(
                "rounded-xl p-3 transition-all",
                currentThrower === leftThrower
                  ? "bg-[#c0392b] ring-2 ring-[#e74c3c] ring-offset-2 ring-offset-[#1a1a1a]"
                  : "bg-[#3a6635] ring-2 ring-[#4a8045] ring-offset-2 ring-offset-[#1a1a1a]"
              )}
              data-testid="panel-player-a"
            >
              <div className="h-4 mb-1">
                {currentThrower === leftThrower && (
                  <div className="flex items-center gap-1">
                    <Eye className="w-3 h-3 text-white/90" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/90">Throwing</span>
                  </div>
                )}
              </div>
              <p className="text-sm font-bold text-white/90 truncate" data-testid="text-player-a-name">
                {leftPlayer?.name || "Player 1"}
              </p>
              <div
                className="text-6xl font-bold text-white tabular-nums leading-none mt-1"
                data-testid="text-remaining-a"
              >
                {leftRemaining}
              </div>
              <div className="mt-2 space-y-0.5 text-xs">
                <div className="flex justify-between text-white/60">
                  <span>3-dart avg.</span>
                  <span className="text-white font-medium tabular-nums">{leftAvg}</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Last score</span>
                  <span className="text-white font-medium tabular-nums">{leftLastScore !== null ? leftLastScore : '-'}</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Darts thrown</span>
                  <span className="text-white font-medium tabular-nums">{leftDarts}</span>
                </div>
              </div>
            </div>

            <div
              className={cn(
                "rounded-xl p-3 transition-all",
                currentThrower === rightThrower
                  ? "bg-[#c0392b] ring-2 ring-[#e74c3c] ring-offset-2 ring-offset-[#1a1a1a]"
                  : "bg-[#3a6635] ring-2 ring-[#4a8045] ring-offset-2 ring-offset-[#1a1a1a]"
              )}
              data-testid="panel-player-b"
            >
              <div className="h-4 mb-1">
                {currentThrower === rightThrower && (
                  <div className="flex items-center gap-1">
                    <Eye className="w-3 h-3 text-white/90" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/90">Throwing</span>
                  </div>
                )}
              </div>
              <p className="text-sm font-bold text-white/90 truncate" data-testid="text-player-b-name">
                {rightPlayer?.name || "Player 2"}
              </p>
              <div
                className="text-6xl font-bold text-white tabular-nums leading-none mt-1"
                data-testid="text-remaining-b"
              >
                {rightRemaining}
              </div>
              <div className="mt-2 space-y-0.5 text-xs">
                <div className="flex justify-between text-white/60">
                  <span>3-dart avg.</span>
                  <span className="text-white font-medium tabular-nums">{rightAvg}</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Last score</span>
                  <span className="text-white font-medium tabular-nums">{rightLastScore !== null ? rightLastScore : '-'}</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Darts thrown</span>
                  <span className="text-white font-medium tabular-nums">{rightDarts}</span>
                </div>
              </div>
            </div>
          </div>

          {bustMessage && (
            <div className="bg-red-600 text-white text-center py-2 rounded-lg mb-2 text-sm font-bold animate-pulse shrink-0" data-testid="text-bust">
              {bustMessage}
            </div>
          )}

          {impossibleWarning && (
            <div className="bg-[#222] border-2 border-yellow-500 rounded-xl p-4 mb-2 shrink-0" data-testid="impossible-warning">
              <p className="text-yellow-400 font-bold text-center text-base mb-1">
                {impossibleWarning.startsWith("BUST") ? "BUST!" : "Impossible Score"}
              </p>
              <p className="text-gray-300 text-center text-sm mb-3">{impossibleWarning}</p>
              <button
                className="w-full h-11 rounded-xl bg-yellow-600 text-white font-semibold text-base touch-manipulation active:bg-yellow-700 transition-colors"
                onClick={() => {
                  setImpossibleWarning(null);
                  setInputValue("");
                }}
                data-testid="button-dismiss-impossible"
              >
                OK
              </button>
            </div>
          )}

          {pendingCheckout && !pendingDartsAtDouble && (
            <div className="bg-[#222] border border-[#3a3a3a] rounded-xl p-4 mb-2 shrink-0" data-testid="checkout-confirm">
              <div className="text-center mb-3">
                <Trophy className="w-8 h-8 text-yellow-400 mx-auto mb-1" />
                <p className="text-white font-bold text-lg">Checkout!</p>
                <p className="text-gray-400 text-sm">
                  {pendingCheckout.player === 'A' ? (getPlayer(activeMatch.playerAId)?.name || 'Player 1') : (getPlayer(activeMatch.playerBId)?.name || 'Player 2')} checked out
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  className="flex-1 h-12 rounded-xl bg-[#3a3a3a] text-gray-300 font-semibold text-base touch-manipulation active:bg-[#4a4a4a] transition-colors"
                  onClick={cancelCheckout}
                  data-testid="button-cancel-checkout"
                >
                  Cancel
                </button>
                <button
                  className="flex-1 h-12 rounded-xl bg-[#4a7a3a] text-white font-semibold text-base touch-manipulation active:bg-[#5a8a4a] transition-colors"
                  onClick={handleConfirmCheckoutClick}
                  disabled={updateScoreMutation.isPending}
                  data-testid="button-confirm-checkout"
                >
                  Confirm Checkout
                </button>
              </div>
            </div>
          )}

          {pendingCheckout && pendingDartsAtDouble && (
            <div className="bg-[#222] border border-[#3a3a3a] rounded-xl p-4 mb-2 shrink-0" data-testid="darts-at-double">
              <div className="text-center mb-3">
                <Target className="w-8 h-8 text-yellow-400 mx-auto mb-1" />
                <p className="text-white font-bold text-lg">Darts at Double?</p>
                <p className="text-gray-400 text-sm">How many darts were used on the double</p>
              </div>
              <div className="flex gap-3">
                {[1, 2, 3].map(n => (
                  <button
                    key={n}
                    className="flex-1 h-14 rounded-xl bg-[#4a7a3a] text-white font-bold text-xl touch-manipulation active:bg-[#5a8a4a] transition-colors"
                    onClick={() => confirmCheckout(n)}
                    disabled={updateScoreMutation.isPending}
                    data-testid={`button-darts-at-double-${n}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showQuickScores && !pendingCheckout && (
            <div className="grid grid-cols-4 gap-1.5 mb-2 shrink-0">
              {QUICK_SCORES.map(qs => (
                <button
                  key={qs}
                  className={cn(
                    "h-11 rounded-lg text-sm font-bold touch-manipulation transition-colors",
                    qs === 180
                      ? "bg-yellow-700/40 text-yellow-300 border border-yellow-600/50"
                      : "bg-[#2a2a2a] text-gray-300 border border-[#3a3a3a]"
                  )}
                  onClick={() => handleScoreSubmit(qs)}
                  disabled={updateScoreMutation.isPending}
                  data-testid={`button-quick-${qs}`}
                >
                  {qs}
                </button>
              ))}
            </div>
          )}

          <div className={cn("flex-1 flex flex-col justify-end pb-2", (pendingCheckout || impossibleWarning) && "opacity-30 pointer-events-none")}>
            <div className="flex gap-1.5 items-center mb-1.5 shrink-0">
              <button
                className="w-11 h-11 rounded-xl bg-[#2a2a2a] border border-[#3a3a3a] flex items-center justify-center touch-manipulation"
                onClick={() => setShowQuickScores(!showQuickScores)}
                data-testid="button-toggle-quick"
              >
                <Grid2x2 className="w-5 h-5 text-gray-400" />
              </button>
              <div
                className="flex-1 bg-[#2a2a2a] border border-[#3a3a3a] rounded-xl px-4 h-11 text-lg font-medium tabular-nums flex items-center justify-between"
                data-testid="text-input-value"
              >
                <span className={inputValue ? "text-white" : "text-gray-500"}>{inputValue || 'Enter a score'}</span>
                {inputValue && (
                  <button
                    className="ml-2 p-1 touch-manipulation"
                    onClick={() => setInputValue(prev => prev.slice(0, -1))}
                    data-testid="button-backspace"
                  >
                    <Delete className="w-5 h-5 text-gray-400" />
                  </button>
                )}
              </div>
            </div>

            {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, ri) => (
              <div key={ri} className="grid grid-cols-3 gap-1.5 mb-1.5">
                {row.map(key => (
                  <button
                    key={key}
                    className="h-[4.2rem] rounded-xl bg-[#2a2a2a] border border-[#3a3a3a] text-white text-2xl font-semibold touch-manipulation active:bg-[#3a3a3a] transition-colors"
                    onClick={() => handleNumpad(key)}
                    disabled={updateScoreMutation.isPending}
                    data-testid={`button-numpad-${key}`}
                  >
                    {key}
                  </button>
                ))}
              </div>
            ))}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                className="h-[4.2rem] rounded-xl bg-[#2a2a2a] border border-[#3a3a3a] flex items-center justify-center touch-manipulation active:bg-[#3a3a3a] transition-colors"
                onClick={handleUndo}
                disabled={legVisits.length === 0 || updateScoreMutation.isPending}
                data-testid="button-undo"
              >
                <Undo2 className={cn("w-6 h-6", legVisits.length === 0 ? "text-gray-600" : "text-gray-300")} />
              </button>
              <button
                className="h-[4.2rem] rounded-xl bg-[#2a2a2a] border border-[#3a3a3a] text-white text-2xl font-semibold touch-manipulation active:bg-[#3a3a3a] transition-colors"
                onClick={() => handleNumpad('0')}
                disabled={updateScoreMutation.isPending}
                data-testid="button-numpad-0"
              >
                0
              </button>
              <button
                className="h-[4.2rem] rounded-xl flex items-center justify-center touch-manipulation transition-colors bg-[#4a7a3a] border border-[#5a9a4a] active:bg-[#5a8a4a]"
                onClick={() => handleNumpad('OK')}
                disabled={updateScoreMutation.isPending}
                data-testid="button-numpad-OK"
              >
                <Check className="w-7 h-7 text-white" />
              </button>
            </div>
          </div>

          {updateScoreMutation.isPending && (
            <div className="flex items-center justify-center py-1 shrink-0">
              <Loader2 className="w-4 h-4 animate-spin text-green-400 mr-2" />
              <span className="text-xs text-gray-500">Updating...</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === "matchReport" && matchReport) {
    const stats = matchReport;
    const avgA = stats.totalVisitsA > 0 ? ((stats.totalScoredA / stats.totalVisitsA) * 1).toFixed(1) : '0.0';
    const avgB = stats.totalVisitsB > 0 ? ((stats.totalScoredB / stats.totalVisitsB) * 1).toFixed(1) : '0.0';
    const winnerName = stats.winnerId === null ? null : stats.winnerId === stats.playerAId ? stats.playerAName : stats.playerBName;

    const checkoutRateA = stats.checkoutAttemptsA > 0
      ? ((stats.checkoutSuccessA / stats.checkoutAttemptsA) * 100).toFixed(2) + '%'
      : '0.00%';
    const checkoutRateB = stats.checkoutAttemptsB > 0
      ? ((stats.checkoutSuccessB / stats.checkoutAttemptsB) * 100).toFixed(2) + '%'
      : '0.00%';

    const statRows: Array<{ label: string; valA: string | number; valB: string | number }> = [
      { label: 'Legs Won', valA: stats.legsWonA, valB: stats.legsWonB },
      { label: '3-Dart Avg', valA: avgA, valB: avgB },
      { label: 'Checkout %', valA: checkoutRateA, valB: checkoutRateB },
      { label: 'Highest Score', valA: stats.highestVisitA, valB: stats.highestVisitB },
      { label: 'Highest Finish', valA: stats.highestFinishA || '-', valB: stats.highestFinishB || '-' },
      { label: '180s', valA: stats.ton80sA, valB: stats.ton80sB },
      { label: '140+', valA: stats.ton40sA, valB: stats.ton40sB },
      { label: '100+', valA: stats.tonsA, valB: stats.tonsB },
    ];

    return (
      <div className="min-h-[100dvh] bg-[#1a1a1a] flex flex-col" data-testid="match-report-view">
        <div className="bg-primary text-primary-foreground py-2 px-3 shadow-lg shrink-0">
          <div className="flex items-center gap-2 max-w-4xl mx-auto">
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground shrink-0 h-8 w-8"
              onClick={() => {
                setMatchReport(null);
                setView("matchList");
              }}
              data-testid="button-back-from-report"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-primary-foreground/80 truncate">
                {tournament.name} — {group.name} — Board {boardNumber}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto w-full max-w-lg mx-auto px-4 py-4">
          <div className="text-center mb-6">
            <Trophy className="w-10 h-10 text-yellow-400 mx-auto mb-2" />
            <h2 className="text-white text-xl font-bold">Match Report</h2>
            <p className="text-gray-400 text-sm mt-1">{winnerName ? `${winnerName} wins!` : 'Match drawn!'}</p>
          </div>

          <div className="flex items-center justify-between mb-6 px-2">
            <div className="text-center flex-1">
              <div className="w-12 h-12 rounded-full bg-[#c0392b] flex items-center justify-center mx-auto mb-1">
                <span className="text-white font-bold text-lg">{stats.playerAName.charAt(0)}</span>
              </div>
              <p className="text-white text-sm font-medium truncate max-w-[120px] mx-auto">{stats.playerAName}</p>
            </div>
            <div className="text-center px-4">
              <div className="text-3xl font-bold tabular-nums">
                <span className={stats.legsWonA > stats.legsWonB ? "text-white" : "text-gray-500"}>{stats.legsWonA}</span>
                <span className="text-gray-600 mx-2">-</span>
                <span className={stats.legsWonB > stats.legsWonA ? "text-white" : "text-gray-500"}>{stats.legsWonB}</span>
              </div>
            </div>
            <div className="text-center flex-1">
              <div className="w-12 h-12 rounded-full bg-[#4a6741] flex items-center justify-center mx-auto mb-1">
                <span className="text-white font-bold text-lg">{stats.playerBName.charAt(0)}</span>
              </div>
              <p className="text-white text-sm font-medium truncate max-w-[120px] mx-auto">{stats.playerBName}</p>
            </div>
          </div>

          <div className="space-y-1">
            {statRows.map((row, i) => {
              const aNum = typeof row.valA === 'string' ? parseFloat(row.valA) : row.valA;
              const bNum = typeof row.valB === 'string' ? parseFloat(row.valB) : row.valB;
              const aHigher = aNum > bNum;
              const bHigher = bNum > aNum;
              return (
                <div
                  key={i}
                  className="flex items-center py-2.5 px-3 rounded-lg bg-[#222]"
                  data-testid={`stat-row-${i}`}
                >
                  <span className={cn(
                    "flex-1 text-left tabular-nums font-semibold text-sm",
                    aHigher ? "text-white" : "text-gray-500"
                  )}>
                    {row.valA}
                  </span>
                  <span className="text-gray-400 text-xs font-medium text-center min-w-[100px]">{row.label}</span>
                  <span className={cn(
                    "flex-1 text-right tabular-nums font-semibold text-sm",
                    bHigher ? "text-white" : "text-gray-500"
                  )}>
                    {row.valB}
                  </span>
                </div>
              );
            })}
          </div>

          <Button
            className="w-full mt-6 h-12 text-base font-semibold bg-primary hover:bg-primary/90"
            onClick={() => {
              setMatchReport(null);
              setView("matchList");
            }}
            data-testid="button-back-to-matches"
          >
            Back to Matches
          </Button>
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
              <button
                onClick={toggleTheme}
                className="p-1.5 rounded hover:bg-white/10 transition-colors"
                data-testid="button-toggle-theme-scorer-list"
              >
                {theme === "light" ? <Moon className="w-4 h-4 text-primary-foreground" /> : <Sun className="w-4 h-4 text-primary-foreground" />}
              </button>
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
