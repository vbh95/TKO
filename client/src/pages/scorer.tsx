import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeft,
  Check,
  Crosshair,
  Delete,
  Grid2x2,
  Loader2,
  Moon,
  Sun,
  Target,
  Trophy,
  Undo2,
  Wifi,
  WifiOff,
  Play,
  ChevronRight,
  RotateCcw,
  Camera,
  ScanLine,
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import tkoLogoWhite from "@assets/TKO_White-04_1771796486840.png";
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

interface ScorerState {
  matchId: number;
  remainingA: number;
  remainingB: number;
  currentThrower: 'A' | 'B';
  legsWonA: number;
  legsWonB: number;
  legVisits: Visit[];
  allMatchVisits: Visit[];
  legStartingThrower: 'A' | 'B';
  checkoutStats: { attemptsA: number; attemptsB: number; successA: number; successB: number; finishA: number; finishB: number };
  swapPlayers: boolean;
}

function saveScorerState(state: ScorerState) {
  try {
    localStorage.setItem(`tko_scorer_${state.matchId}`, JSON.stringify(state));
  } catch {}
}

function loadScorerState(matchId: number): ScorerState | null {
  try {
    const raw = localStorage.getItem(`tko_scorer_${matchId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function clearScorerState(matchId: number) {
  try {
    localStorage.removeItem(`tko_scorer_${matchId}`);
  } catch {}
}

function ScorerReconnect() {
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "qr-reader";

  const startScanning = useCallback(async () => {
    setScanError(null);
    setScanning(true);

    try {
      const scanner = new Html5Qrcode(scannerContainerId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          scanner.stop().catch(() => {});
          scannerRef.current = null;

          try {
            let targetPath: string | null = null;

            if (decodedText.startsWith("/")) {
              targetPath = decodedText;
            } else {
              const url = new URL(decodedText);
              if (url.origin !== window.location.origin) {
                setScanError("That QR code is from a different site. Please scan the QR from your tournament admin.");
                setScanning(false);
                return;
              }
              targetPath = url.pathname + url.search;
            }

            const isPairUrl = targetPath.startsWith("/pair?") || targetPath.startsWith("/pair&");
            const isScorerUrl = /^\/scorer\/\d+\/\d+/.test(targetPath);

            if (isPairUrl || isScorerUrl) {
              window.location.href = targetPath;
            } else {
              setScanError("That QR code doesn't look like a board pairing code. Please scan the QR from the tournament admin.");
              setScanning(false);
            }
          } catch {
            setScanError("Invalid QR code. Please scan the pairing QR from the tournament admin.");
            setScanning(false);
          }
        },
        () => {}
      );
    } catch (err: any) {
      setScanError(err?.message || "Could not access camera. Please allow camera permissions.");
      setScanning(false);
    }
  }, []);

  const stopScanning = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-6 bg-[hsl(222.2,84%,4.9%)]">
      <img src={tkoLogoWhite} alt="TKO" className="w-20 h-20 mb-6 opacity-80" />
      <ScanLine className="w-14 h-14 text-primary mb-4" />
      <h1 className="text-2xl font-bold text-white mb-2">Board Not Connected</h1>
      <p className="text-gray-400 max-w-sm mb-8">
        This scorer tablet needs to be paired to a board. Scan the QR code from the tournament admin to connect.
      </p>

      {!scanning ? (
        <button
          onClick={startScanning}
          className="flex items-center gap-3 px-8 py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-lg touch-manipulation active:bg-primary/80 transition-colors"
          data-testid="button-scan-qr"
        >
          <Camera className="w-6 h-6" />
          Scan QR Code
        </button>
      ) : (
        <div className="w-full max-w-sm">
          <div id={scannerContainerId} className="rounded-xl overflow-hidden mb-4" />
          <button
            onClick={stopScanning}
            className="w-full py-3 rounded-xl bg-gray-700 text-white font-semibold touch-manipulation active:bg-gray-600 transition-colors"
            data-testid="button-stop-scan"
          >
            Cancel
          </button>
        </div>
      )}

      {scanError && (
        <p className="text-red-400 mt-4 max-w-sm text-sm" data-testid="text-scan-error">{scanError}</p>
      )}
      <AddToHomeBanner />
    </div>
  );
}

function AddToHomeBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | null>(null);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;
    if (isStandalone) return;

    const wasDismissed = sessionStorage.getItem('tko_a2hs_dismissed');
    if (wasDismissed) return;

    const ua = navigator.userAgent.toLowerCase();
    const isIPadOS = /macintosh/.test(ua) && navigator.maxTouchPoints > 1;
    const isIOS = /iphone|ipad|ipod/.test(ua) || isIPadOS;
    const isSafari = /safari/.test(ua) && !/crios|fxios|chrome|android/.test(ua);

    if (isIOS && isSafari) {
      setPlatform('ios');
    } else if (/android/.test(ua) && /chrome/.test(ua)) {
      setPlatform('android');
    }
  }, []);

  if (dismissed || !platform) return null;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('tko_a2hs_dismissed', '1');
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[300] p-3 animate-in slide-in-from-bottom duration-300" data-testid="add-to-home-banner">
      <div className="bg-primary rounded-xl p-4 shadow-lg max-w-md mx-auto">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="text-primary-foreground font-bold text-sm mb-1">Add TKO Scorer to Home Screen</p>
            {platform === 'ios' ? (
              <p className="text-primary-foreground/70 text-xs">
                Tap the <span className="inline-block px-1 font-semibold">Share</span> button, then <span className="font-semibold">"Add to Home Screen"</span> for full-screen mode.
              </p>
            ) : (
              <p className="text-primary-foreground/70 text-xs">
                Tap the <span className="font-semibold">menu (⋮)</span> button, then <span className="font-semibold">"Add to Home screen"</span> for full-screen mode.
              </p>
            )}
          </div>
          <button
            onClick={handleDismiss}
            className="text-primary-foreground/60 hover:text-primary-foreground text-lg font-bold leading-none mt-0.5 touch-manipulation"
            data-testid="button-dismiss-a2hs"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

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

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.style.overscrollBehavior = 'none';
    body.style.overscrollBehavior = 'none';
    body.style.touchAction = 'pan-x pan-y';
    return () => {
      html.style.overscrollBehavior = '';
      body.style.overscrollBehavior = '';
      body.style.touchAction = '';
    };
  }, []);

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
        const saved = loadScorerState(inProgress.id);
        if (saved && saved.matchId === inProgress.id) {
          setActiveMatchId(inProgress.id);
          setLegsWonA(saved.legsWonA);
          setLegsWonB(saved.legsWonB);
          setRemainingA(saved.remainingA);
          setRemainingB(saved.remainingB);
          setCurrentThrower(saved.currentThrower);
          setLegVisits(saved.legVisits);
          setAllMatchVisits(saved.allMatchVisits);
          setLegStartingThrower(saved.legStartingThrower);
          setCheckoutAttemptsA(saved.checkoutStats.attemptsA);
          setCheckoutAttemptsB(saved.checkoutStats.attemptsB);
          setCheckoutSuccessA(saved.checkoutStats.successA);
          setCheckoutSuccessB(saved.checkoutStats.successB);
          setHighestFinishA(saved.checkoutStats.finishA);
          setHighestFinishB(saved.checkoutStats.finishB);
          checkoutStatsRef.current = { ...saved.checkoutStats };
          setSwapPlayers(saved.swapPlayers);
          setView("scoring");
          const pA = data?.players.find(p => p.id === inProgress.playerAId);
          const pB = data?.players.find(p => p.id === inProgress.playerBId);
          if (pA && pB) {
            const vA = saved.legVisits.filter(v => v.player === 'A');
            const vB = saved.legVisits.filter(v => v.player === 'B');
            fetch(`/api/scorer/matches/${inProgress.id}/leg-scoring`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                remainingA: saved.remainingA,
                remainingB: saved.remainingB,
                currentThrower: saved.currentThrower,
                legsWonA: saved.legsWonA,
                legsWonB: saved.legsWonB,
                playerAName: pA.name,
                playerBName: pB.name,
                bestOf: inProgress.bestOf || 3,
                avgA: vA.length > 0 ? (vA.reduce((s, vi) => s + vi.score, 0) / vA.length).toFixed(2) : '0.00',
                avgB: vB.length > 0 ? (vB.reduce((s, vi) => s + vi.score, 0) / vB.length).toFixed(2) : '0.00',
                dartsA: vA.length * 3,
                dartsB: vB.length * 3,
                lastScoreA: vA.length > 0 ? vA[vA.length - 1].score : null,
                lastScoreB: vB.length > 0 ? vB[vB.length - 1].score : null,
              }),
            }).catch(() => {});
          }
        } else {
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
    mutationFn: async ({ matchId, scoreA, scoreB, notes }: { matchId: number; scoreA: number; scoreB: number; notes?: any }) => {
      const res = await fetch(`/api/scorer/matches/${matchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ scoreA, scoreB, notes }),
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
  };

  const persistCurrentState = useCallback((overrides?: Partial<ScorerState>) => {
    if (activeMatchId === null) return;
    const state: ScorerState = {
      matchId: activeMatchId,
      remainingA,
      remainingB,
      currentThrower,
      legsWonA,
      legsWonB,
      legVisits,
      allMatchVisits,
      legStartingThrower,
      checkoutStats: { ...checkoutStatsRef.current },
      swapPlayers,
      ...overrides,
    };
    saveScorerState(state);
  }, [activeMatchId, remainingA, remainingB, currentThrower, legsWonA, legsWonB, legVisits, allMatchVisits, legStartingThrower, swapPlayers]);

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
      setInputValue("");
      setImpossibleWarning(`${score} is not possible from ${currentRemaining}`);
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

    emitLiveState(
      isPlayerA ? newRemaining : remainingA,
      !isPlayerA ? newRemaining : remainingB,
      nextThrower,
      legsWonA,
      legsWonB,
    );

    persistCurrentState({
      remainingA: isPlayerA ? newRemaining : remainingA,
      remainingB: !isPlayerA ? newRemaining : remainingB,
      currentThrower: nextThrower,
      legVisits: newVisits,
    });
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

    const allVisitsIncludingCurrent = [...allMatchVisits, ...newVisits];
    const isMatchFinished = newLegsA >= matchLegsToWin || newLegsB >= matchLegsToWin;
    let matchNotes: any = undefined;
    if (isMatchFinished) {
      const vA = allVisitsIncludingCurrent.filter(v => v.player === 'A');
      const vB = allVisitsIncludingCurrent.filter(v => v.player === 'B');
      const cs = checkoutStatsRef.current;
      const highestCheckoutVal = Math.max(cs.finishA, cs.finishB);
      const total180s = vA.filter(v => v.score === 180).length + vB.filter(v => v.score === 180).length;
      matchNotes = {
        highestCheckout: highestCheckoutVal > 0 ? highestCheckoutVal : undefined,
        numberOf180s: total180s,
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
        checkoutAttemptsA: cs.attemptsA,
        checkoutAttemptsB: cs.attemptsB,
        checkoutSuccessA: cs.successA,
        checkoutSuccessB: cs.successB,
      };
    }

    updateScoreMutation.mutate({
      matchId: activeMatchId,
      scoreA: newLegsA,
      scoreB: newLegsB,
      notes: matchNotes,
    });

    setAllMatchVisits(allVisitsIncludingCurrent);

    if (newLegsA < matchLegsToWin && newLegsB < matchLegsToWin) {
      const playerName = isPlayerA
        ? data?.players.find(p => p.id === activeM.playerAId)?.name
        : data?.players.find(p => p.id === activeM.playerBId)?.name;
      toast({ title: `Leg won by ${playerName || 'Player'}!` });

      const nextStarter = legStartingThrower === 'A' ? 'B' : 'A';
      persistCurrentState({
        legsWonA: newLegsA,
        legsWonB: newLegsB,
        allMatchVisits: allVisitsIncludingCurrent,
        remainingA: STARTING_SCORE,
        remainingB: STARTING_SCORE,
        currentThrower: nextStarter,
        legStartingThrower: nextStarter,
        legVisits: [],
      });
      setTimeout(() => resetLeg(nextStarter), 1500);
    } else {
      clearScorerState(activeMatchId);
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
        const newR = remainingA + lastVisit.score;
        setRemainingA(newR);
        persistCurrentState({ remainingA: newR, legVisits: restored });
      } else {
        const newR = remainingB + lastVisit.score;
        setRemainingB(newR);
        persistCurrentState({ remainingB: newR, legVisits: restored });
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
      persistCurrentState({ remainingA: newR, currentThrower: 'A', legVisits: newVisits });
    } else {
      const newR = remainingB + lastVisit.score;
      setRemainingB(newR);
      setCurrentThrower('B');
      emitLiveState(remainingA, newR, 'B', legsWonA, legsWonB);
      persistCurrentState({ remainingB: newR, currentThrower: 'B', legVisits: newVisits });
    }

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
        setImpossibleWarning("Invalid score");
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
    return <ScorerReconnect />;
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
      const saved = loadScorerState(matchId);
      if (saved && saved.matchId === matchId) {
        setActiveMatchId(matchId);
        setLegsWonA(saved.legsWonA);
        setLegsWonB(saved.legsWonB);
        setRemainingA(saved.remainingA);
        setRemainingB(saved.remainingB);
        setCurrentThrower(saved.currentThrower);
        setLegVisits(saved.legVisits);
        setAllMatchVisits(saved.allMatchVisits);
        setLegStartingThrower(saved.legStartingThrower);
        setCheckoutAttemptsA(saved.checkoutStats.attemptsA);
        setCheckoutAttemptsB(saved.checkoutStats.attemptsB);
        setCheckoutSuccessA(saved.checkoutStats.successA);
        setCheckoutSuccessB(saved.checkoutStats.successB);
        setHighestFinishA(saved.checkoutStats.finishA);
        setHighestFinishB(saved.checkoutStats.finishB);
        checkoutStatsRef.current = { ...saved.checkoutStats };
        setSwapPlayers(saved.swapPlayers);
        setView("scoring");
        const pA = data?.players.find(p => p.id === match.playerAId);
        const pB = data?.players.find(p => p.id === match.playerBId);
        if (pA && pB) {
          const vA = saved.legVisits.filter(v => v.player === 'A');
          const vB = saved.legVisits.filter(v => v.player === 'B');
          fetch(`/api/scorer/matches/${matchId}/leg-scoring`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              remainingA: saved.remainingA,
              remainingB: saved.remainingB,
              currentThrower: saved.currentThrower,
              legsWonA: saved.legsWonA,
              legsWonB: saved.legsWonB,
              playerAName: pA.name,
              playerBName: pB.name,
              bestOf: match.bestOf || 3,
              avgA: vA.length > 0 ? (vA.reduce((s, vi) => s + vi.score, 0) / vA.length).toFixed(2) : '0.00',
              avgB: vB.length > 0 ? (vB.reduce((s, vi) => s + vi.score, 0) / vB.length).toFixed(2) : '0.00',
              dartsA: vA.length * 3,
              dartsB: vB.length * 3,
              lastScoreA: vA.length > 0 ? vA[vA.length - 1].score : null,
              lastScoreB: vB.length > 0 ? vB[vB.length - 1].score : null,
            }),
          }).catch(() => {});
        }
      } else {
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
      }
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
        const initLegsA = activeMatch.scoreA || 0;
        const initLegsB = activeMatch.scoreB || 0;
        setLegsWonA(initLegsA);
        setLegsWonB(initLegsB);
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
        saveScorerState({
          matchId: activeMatch.id,
          remainingA: STARTING_SCORE,
          remainingB: STARTING_SCORE,
          currentThrower: thrower,
          legsWonA: initLegsA,
          legsWonB: initLegsB,
          legVisits: [],
          allMatchVisits: [],
          legStartingThrower: thrower,
          checkoutStats: { attemptsA: 0, attemptsB: 0, successA: 0, successB: 0, finishA: 0, finishB: 0 },
          swapPlayers: thrower === 'B',
        });
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
        <div className="flex-1 flex flex-col items-center justify-center px-6 bg-[#020817]">
          <Target className="w-14 h-14 md:w-20 md:h-20 text-yellow-400 mb-4" />
          <h2 className="text-white text-2xl md:text-4xl font-bold mb-1">Throw for the Bull</h2>
          <p className="text-gray-400 text-sm md:text-lg mb-8">Select player to start</p>

          <div className="w-full max-w-sm md:max-w-md space-y-3 md:space-y-4">
            <button
              className="w-full h-16 md:h-20 rounded-xl bg-[#3a6635] border border-[#4a8045] text-white text-lg md:text-2xl font-bold touch-manipulation active:bg-[#4a7a3a] transition-colors"
              onClick={() => handleFirstThrower('A')}
              disabled={startMatchMutation.isPending}
              data-testid="button-first-thrower-a"
            >
              {playerA?.name || 'Player 1'}
            </button>

            <p className="text-gray-500 text-center text-sm md:text-lg font-medium">vs</p>

            <button
              className="w-full h-16 md:h-20 rounded-xl bg-[#3a6635] border border-[#4a8045] text-white text-lg md:text-2xl font-bold touch-manipulation active:bg-[#4a7a3a] transition-colors"
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
      <div className="fixed inset-0 bg-[hsl(222.2,84%,4.9%)] flex flex-col overflow-hidden z-[100]" data-testid="scorer-match-view">
        <div className="bg-primary text-primary-foreground py-1 md:py-2 px-3 shadow-lg shrink-0">
          <div className="relative flex items-center max-w-4xl mx-auto h-8 md:h-10">
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground shrink-0 h-7 w-7 z-10"
              onClick={() => {
                setView("matchList");
                setActiveMatchId(null);
              }}
              data-testid="button-back-to-list"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </Button>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <img src={tkoLogoWhite} alt="TKO" className="h-5 md:h-7 pointer-events-auto" />
            </div>
            <div className="ml-auto flex items-center gap-1.5 md:gap-3 z-10">
              <button
                onClick={toggleTheme}
                className="p-1 rounded hover:bg-white/10 transition-colors"
                data-testid="button-toggle-theme-scorer"
              >
                {theme === "light" ? <Moon className="w-3 h-3 text-primary-foreground" /> : <Sun className="w-3 h-3 text-primary-foreground" />}
              </button>
              {isConnected ? (
                <Badge variant="outline" className="border-green-400 text-green-100 gap-1 text-[9px] md:text-[10px] py-0 px-1.5 h-5">
                  <Wifi className="w-2.5 h-2.5" /> Live
                </Badge>
              ) : (
                <Badge variant="outline" className="border-red-400 text-red-100 gap-1 text-[9px] md:text-[10px] py-0 px-1.5 h-5">
                  <WifiOff className="w-2.5 h-2.5" /> Off
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col w-full max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-2 md:px-4 py-0.5 md:py-1 overflow-hidden">
          {legVisits.length === 0 && legsWonA === 0 && legsWonB === 0 && (
            <div className="flex justify-center mb-0.5 shrink-0">
              <button
                className="flex items-center gap-1 text-gray-400 text-[9px] md:text-[10px] px-2 py-0.5 rounded-lg bg-[#2a2a2a] border-2 border-[#3a3a3a] touch-manipulation active:bg-[#3a3a3a] transition-colors"
                onClick={() => setView("bullThrow")}
                data-testid="button-back-to-bull"
              >
                <ArrowLeft className="w-2.5 h-2.5" />
                Bull Throw
              </button>
            </div>
          )}
          <div className="text-center py-0.5 md:py-1 shrink-0">
            <p className="text-gray-400 text-[9px] md:text-xs uppercase tracking-wider font-semibold">
              Leg {currentLeg} — Best of {matchBestOf}
            </p>
            <div className="tabular-nums mt-0 flex items-center justify-center gap-2">
              <span className={cn("text-xl md:text-4xl lg:text-5xl font-bold", leftLegs >= rightLegs ? "text-white" : "text-gray-500")}>{leftLegs}</span>
              <span className="text-gray-600 text-lg md:text-2xl">-</span>
              <span className={cn("text-xl md:text-4xl lg:text-5xl font-bold", rightLegs >= leftLegs ? "text-white" : "text-gray-500")}>{rightLegs}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:gap-4 lg:gap-6 mt-1 md:mt-2 mb-1 md:mb-2 lg:mb-3 shrink-0">
            <div
              className={cn(
                "rounded-xl p-2 md:p-4 lg:p-6 transition-all duration-300 flex flex-col justify-center min-h-[140px] md:min-h-[200px] lg:min-h-[280px]",
                currentThrower === leftThrower
                  ? "bg-primary ring-2 ring-primary ring-offset-2 ring-offset-[hsl(222.2,84%,4.9%)] scale-105 z-10 shadow-2xl"
                  : "bg-primary/20 ring-2 ring-primary/30 ring-offset-2 ring-offset-[hsl(222.2,84%,4.9%)] scale-95 opacity-80 grayscale-[30%]"
              )}
              data-testid="panel-player-a"
            >
              <div className="h-4 md:h-6 mb-1">
                {currentThrower === leftThrower && (
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="text-[10px] md:text-xs font-black uppercase tracking-widest text-white">Throwing</span>
                    <Crosshair className="w-3.5 h-3.5 md:w-5 md:h-5 text-white" />
                  </div>
                )}
              </div>
              <p className="text-xs md:text-lg lg:text-xl font-black text-white truncate mb-1 uppercase tracking-tight" data-testid="text-player-a-name">
                {leftPlayer?.name || "Player 1"}
              </p>
              <div
                className="text-5xl md:text-8xl lg:text-[9rem] font-bold text-white tabular-nums leading-none tracking-tighter"
                data-testid="text-remaining-a"
              >
                {leftRemaining}
              </div>
              <div className="mt-1 md:mt-3 lg:mt-4 grid grid-cols-2 gap-x-2 gap-y-0.5 md:gap-y-1 text-[8px] md:text-xs lg:text-sm border-t border-white/10 pt-1 md:pt-2">
                <div className="flex flex-col">
                  <span className="text-white/40 uppercase text-[7px] md:text-[9px] font-bold">3-dart avg</span>
                  <span className="text-white font-bold tabular-nums">{leftAvg}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-white/40 uppercase text-[7px] md:text-[9px] font-bold">Last score</span>
                  <span className="text-white font-bold tabular-nums">{leftLastScore !== null ? leftLastScore : '-'}</span>
                </div>
              </div>
            </div>

            <div
              className={cn(
                "rounded-xl p-2 md:p-4 lg:p-6 transition-all duration-300 flex flex-col justify-center min-h-[140px] md:min-h-[200px] lg:min-h-[280px]",
                currentThrower === rightThrower
                  ? "bg-primary ring-2 ring-primary ring-offset-2 ring-offset-[hsl(222.2,84%,4.9%)] scale-105 z-10 shadow-2xl"
                  : "bg-primary/20 ring-2 ring-primary/30 ring-offset-2 ring-offset-[hsl(222.2,84%,4.9%)] scale-95 opacity-80 grayscale-[30%]"
              )}
              data-testid="panel-player-b"
            >
              <div className="h-4 md:h-6 mb-1">
                {currentThrower === rightThrower && (
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="text-[10px] md:text-xs font-black uppercase tracking-widest text-white">Throwing</span>
                    <Crosshair className="w-3.5 h-3.5 md:w-5 md:h-5 text-white" />
                  </div>
                )}
              </div>
              <p className="text-xs md:text-lg lg:text-xl font-black text-white truncate mb-1 uppercase tracking-tight" data-testid="text-player-b-name">
                {rightPlayer?.name || "Player 2"}
              </p>
              <div
                className="text-5xl md:text-8xl lg:text-[9rem] font-bold text-white tabular-nums leading-none tracking-tighter"
                data-testid="text-remaining-b"
              >
                {rightRemaining}
              </div>
              <div className="mt-1 md:mt-3 lg:mt-4 grid grid-cols-2 gap-x-2 gap-y-0.5 md:gap-y-1 text-[8px] md:text-xs lg:text-sm border-t border-white/10 pt-1 md:pt-2">
                <div className="flex flex-col">
                  <span className="text-white/40 uppercase text-[7px] md:text-[9px] font-bold">3-dart avg</span>
                  <span className="text-white font-bold tabular-nums">{rightAvg}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-white/40 uppercase text-[7px] md:text-[9px] font-bold">Last score</span>
                  <span className="text-white font-bold tabular-nums">{rightLastScore !== null ? rightLastScore : '-'}</span>
                </div>
              </div>
            </div>
          </div>

          {(impossibleWarning || pendingCheckout) && (
            <div className="fixed inset-0 bg-black/60 z-[150]" />
          )}

          {impossibleWarning && (
            <div className="bg-primary rounded-xl p-4 md:p-6 mb-1 shrink-0 relative z-[200]" data-testid="impossible-warning">
              <p className="text-primary-foreground font-bold text-center text-2xl md:text-3xl mb-2">
                {impossibleWarning.includes("not possible") ? "BUST!" : "Impossible Score"}
              </p>
              <p className="text-primary-foreground/80 text-center text-sm md:text-lg mb-4">{impossibleWarning}</p>
              <div className="flex gap-2">
                <button
                  className="flex-1 h-12 md:h-14 rounded-xl bg-primary-foreground/20 text-primary-foreground font-semibold text-base md:text-lg touch-manipulation active:bg-primary-foreground/30 transition-colors"
                  onClick={() => {
                    setImpossibleWarning(null);
                    setInputValue("");
                  }}
                  data-testid="button-dismiss-impossible"
                >
                  OK
                </button>
                {impossibleWarning.includes("not possible") && (
                  <button
                    className="flex-1 h-12 md:h-14 rounded-xl bg-primary-foreground/20 text-primary-foreground font-semibold text-base md:text-lg touch-manipulation active:bg-primary-foreground/30 transition-colors"
                    onClick={() => {
                      setImpossibleWarning(null);
                      setInputValue("");
                      handleScoreSubmit(0);
                    }}
                    data-testid="button-pass-turn"
                  >
                    Pass Turn
                  </button>
                )}
              </div>
            </div>
          )}

          {pendingCheckout && !pendingDartsAtDouble && (
            <div className="bg-primary rounded-xl p-3 md:p-5 mb-1 shrink-0 relative z-[200]" data-testid="checkout-confirm">
              <div className="text-center mb-2 md:mb-3">
                <Trophy className="w-6 h-6 md:w-10 md:h-10 text-primary-foreground mx-auto mb-1" />
                <p className="text-primary-foreground font-bold text-base md:text-xl">Checkout!</p>
                <p className="text-primary-foreground/70 text-xs md:text-sm">
                  {pendingCheckout.player === 'A' ? (getPlayer(activeMatch.playerAId)?.name || 'Player 1') : (getPlayer(activeMatch.playerBId)?.name || 'Player 2')} checked out
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="flex-1 h-10 md:h-14 rounded-xl bg-primary-foreground/20 text-primary-foreground font-semibold text-sm md:text-base touch-manipulation active:bg-primary-foreground/30 transition-colors"
                  onClick={cancelCheckout}
                  data-testid="button-cancel-checkout"
                >
                  Cancel
                </button>
                <button
                  className="flex-1 h-10 md:h-14 rounded-xl bg-primary-foreground/20 text-primary-foreground font-semibold text-sm md:text-base touch-manipulation active:bg-primary-foreground/30 transition-colors"
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
            <div className="bg-primary rounded-xl p-3 md:p-5 mb-1 shrink-0 relative z-[200]" data-testid="darts-at-double">
              <div className="text-center mb-2 md:mb-3">
                <Target className="w-6 h-6 md:w-10 md:h-10 text-primary-foreground mx-auto mb-1" />
                <p className="text-primary-foreground font-bold text-base md:text-xl">Darts at Double?</p>
                <p className="text-primary-foreground/70 text-xs md:text-sm">How many darts were used on the double</p>
              </div>
              <div className="flex gap-2 md:gap-3">
                {[1, 2, 3].map(n => (
                  <button
                    key={n}
                    className="flex-1 h-12 md:h-16 rounded-xl bg-primary-foreground/20 text-primary-foreground font-bold text-lg md:text-2xl touch-manipulation active:bg-primary-foreground/30 transition-colors"
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

          <div className={cn("flex-1 flex flex-col justify-end pb-1 md:pb-2", (pendingCheckout || impossibleWarning) && "opacity-30 pointer-events-none")}>
            <div className="flex-1 flex flex-col justify-end gap-1 md:gap-1.5">
              <div className="flex gap-1 md:gap-1.5 items-center shrink-0">
                <button
                  className="w-9 h-9 md:w-12 md:h-12 rounded-lg bg-[#2a2a2a] border-2 border-[#3a3a3a] flex items-center justify-center touch-manipulation"
                  onClick={() => setShowQuickScores(!showQuickScores)}
                  data-testid="button-toggle-quick"
                >
                  <Grid2x2 className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                </button>
                <div
                  className="flex-1 bg-[#2a2a2a] border-2 border-[#3a3a3a] rounded-lg px-3 h-9 md:h-12 text-base md:text-xl font-medium tabular-nums flex items-center justify-between"
                  data-testid="text-input-value"
                >
                  <span className={inputValue ? "text-white" : "text-gray-600"}>{inputValue || 'Enter a score'}</span>
                  {inputValue && (
                    <button
                      className="ml-2 p-1 touch-manipulation active:scale-90 transition-transform"
                      onClick={() => setInputValue(prev => prev.slice(0, -1))}
                      data-testid="button-backspace"
                    >
                      <Delete className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                    </button>
                  )}
                </div>
              </div>

              {showQuickScores && !pendingCheckout && (
                <div className="grid grid-cols-4 gap-1 md:gap-1.5 shrink-0">
                  {QUICK_SCORES.map(qs => (
                    <button
                      key={qs}
                      className={cn(
                        "h-9 md:h-11 rounded-lg text-xs md:text-sm font-bold touch-manipulation transition-colors",
                        qs === 180
                          ? "bg-yellow-700/40 text-yellow-300 border-2 border-yellow-600/50"
                          : "bg-[#2a2a2a] text-gray-300 border-2 border-[#3a3a3a]"
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

              {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, ri) => (
                <div key={ri} className="grid grid-cols-3 gap-1 md:gap-1.5 flex-1 max-h-[10vh]">
                  {row.map(key => (
                    <button
                      key={key}
                      className="h-full min-h-[36px] rounded-lg bg-[#2a2a2a] border-2 border-[#3a3a3a] text-white text-xl md:text-2xl font-semibold touch-manipulation active:bg-[#3a3a3a] active:scale-[0.98] transition-all flex items-center justify-center"
                      onClick={() => handleNumpad(key)}
                      disabled={updateScoreMutation.isPending}
                      data-testid={`button-numpad-${key}`}
                    >
                      {key}
                    </button>
                  ))}
                </div>
              ))}
              <div className="grid grid-cols-3 gap-1 md:gap-1.5 flex-1 max-h-[10vh]">
                <button
                  className="h-full min-h-[36px] rounded-lg bg-[#2a2a2a] border-2 border-[#3a3a3a] flex items-center justify-center touch-manipulation active:bg-[#3a3a3a] active:scale-[0.98] transition-all"
                  onClick={handleUndo}
                  disabled={legVisits.length === 0 || updateScoreMutation.isPending}
                  data-testid="button-undo"
                >
                  <Undo2 className={cn("w-5 h-5 md:w-7 md:h-7", legVisits.length === 0 ? "text-gray-700" : "text-gray-300")} />
                </button>
                <button
                  className="h-full min-h-[36px] rounded-lg bg-[#2a2a2a] border-2 border-[#3a3a3a] text-white text-xl md:text-2xl font-semibold touch-manipulation active:bg-[#3a3a3a] active:scale-[0.98] transition-all flex items-center justify-center"
                  onClick={() => handleNumpad('0')}
                  disabled={updateScoreMutation.isPending}
                  data-testid="button-numpad-0"
                >
                  0
                </button>
                <button
                  className="h-full min-h-[36px] rounded-lg flex items-center justify-center touch-manipulation transition-all bg-primary border-2 border-primary/50 active:bg-primary/80 active:scale-[0.98]"
                  onClick={() => handleNumpad('OK')}
                  disabled={updateScoreMutation.isPending}
                  data-testid="button-numpad-OK"
                >
                  <Check className="w-6 h-6 md:w-8 md:h-8 text-white stroke-[3px]" />
                </button>
              </div>
            </div>
          </div>

          {updateScoreMutation.isPending && (
            <div className="flex items-center justify-center py-0.5 shrink-0">
              <Loader2 className="w-3 h-3 animate-spin text-green-400 mr-1" />
              <span className="text-[10px] text-gray-500">Updating...</span>
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
      <AddToHomeBanner />
    </div>
  );
}
