import { useParams } from "wouter";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface LiveOverlayData {
  matchId: number;
  status: string;
  tournamentName: string;
  roundLabel: string;
  formatLabel: string;
  playerA: { id: number; name: string } | null;
  playerB: { id: number; name: string } | null;
  scoreA: number;
  scoreB: number;
  live: {
    remainingA: number;
    remainingB: number;
    currentThrower: "A" | "B";
    legsWonA: number;
    legsWonB: number;
    avgA: string;
    avgB: string;
    lastScoreA: number | null;
    lastScoreB: number | null;
    dartsA: number;
    dartsB: number;
  } | null;
}

export default function OverlayPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const [data, setData] = useState<LiveOverlayData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!matchId) return;

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/matches/${matchId}/live`);
        if (!res.ok) { setError(true); return; }
        const json = await res.json();
        setData(json);
        setError(false);
      } catch {
        setError(true);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 1000);
    return () => clearInterval(interval);
  }, [matchId]);

  if (error) {
    return (
      <div style={{ background: "transparent" }} className="w-screen h-screen flex items-end justify-center pb-12">
        <div className="bg-black/80 text-white px-8 py-4 rounded-lg text-lg font-bold">
          Match not found
        </div>
      </div>
    );
  }

  if (!data) return <div style={{ background: "transparent" }} className="w-screen h-screen" />;

  const { tournamentName, roundLabel, formatLabel, playerA, playerB, scoreA, scoreB, live, status } = data;
  const isComplete = status === "COMPLETED";

  const remainingA = live?.remainingA ?? null;
  const remainingB = live?.remainingB ?? null;
  const currentThrower = live?.currentThrower ?? null;
  const legsWonA = live?.legsWonA ?? 0;
  const legsWonB = live?.legsWonB ?? 0;
  const avgA = live?.avgA ?? "-";
  const avgB = live?.avgB ?? "-";
  const lastScoreA = live?.lastScoreA ?? null;
  const lastScoreB = live?.lastScoreB ?? null;

  const playerAName = playerA?.name ?? "Player A";
  const playerBName = playerB?.name ?? "Player B";

  return (
    <>
      <title>{`Overlay – ${playerAName} vs ${playerBName}`}</title>
      <div
        style={{ background: "transparent" }}
        className="w-screen h-screen flex flex-col items-center justify-end"
      >
        <div className="w-full max-w-[1400px] px-10 pb-10 flex flex-col gap-0">
          {isComplete && (
            <div className="flex justify-center mb-3">
              <div className="bg-amber-500 text-black font-black text-xl px-8 py-2 rounded-sm tracking-widest uppercase shadow-2xl">
                Match Complete
              </div>
            </div>
          )}

          <div className="flex flex-col gap-0 shadow-2xl rounded-sm overflow-hidden">
            <div className="flex items-center justify-between bg-black/90 px-5 py-2">
              <span className="text-white/70 text-sm font-bold uppercase tracking-widest truncate">{tournamentName}</span>
              <span className="text-amber-400 text-sm font-black uppercase tracking-widest shrink-0 ml-4">{roundLabel}</span>
            </div>

            <div className="flex items-stretch">
              <PlayerPanel
                name={playerAName}
                remaining={remainingA}
                legsWon={legsWonA}
                matchScore={scoreA}
                avg={avgA}
                lastScore={lastScoreA}
                isActive={currentThrower === "A"}
                side="left"
              />

              <div className="flex flex-col items-center justify-center bg-black/95 px-6 py-4 shrink-0 min-w-[140px]">
                <div className="flex items-center gap-3 mb-1">
                  <span className={cn("text-5xl font-black tabular-nums", scoreA >= scoreB ? "text-white" : "text-white/40")}>
                    {scoreA}
                  </span>
                  <span className="text-white/30 text-2xl font-black">:</span>
                  <span className={cn("text-5xl font-black tabular-nums", scoreB >= scoreA ? "text-white" : "text-white/40")}>
                    {scoreB}
                  </span>
                </div>
                <span className="text-white/40 text-[11px] font-bold uppercase tracking-widest text-center leading-tight">
                  {formatLabel}
                </span>
                {live && (
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-white/50 font-bold uppercase tracking-wider">
                    <span>{legsWonA}</span>
                    <span className="text-white/20">–</span>
                    <span>{legsWonB}</span>
                  </div>
                )}
              </div>

              <PlayerPanel
                name={playerBName}
                remaining={remainingB}
                legsWon={legsWonB}
                matchScore={scoreB}
                avg={avgB}
                lastScore={lastScoreB}
                isActive={currentThrower === "B"}
                side="right"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function PlayerPanel({
  name,
  remaining,
  legsWon,
  matchScore,
  avg,
  lastScore,
  isActive,
  side,
}: {
  name: string;
  remaining: number | null;
  legsWon: number;
  matchScore: number;
  avg: string;
  lastScore: number | null;
  isActive: boolean;
  side: "left" | "right";
}) {
  const isLeft = side === "left";

  return (
    <div
      className={cn(
        "flex-1 flex flex-col justify-between py-4 px-6 relative transition-all duration-300",
        isActive
          ? "bg-[#1a1a2e]/95 border-t-4 border-amber-400"
          : "bg-black/90 border-t-4 border-transparent"
      )}
    >
      {isActive && (
        <div
          className={cn(
            "absolute top-0 w-3 h-3 bg-amber-400 rounded-full mt-[-2px]",
            isLeft ? "left-4" : "right-4"
          )}
        />
      )}

      <div className={cn("flex items-start gap-3", isLeft ? "flex-row" : "flex-row-reverse")}>
        <div className={cn("flex-1", isLeft ? "text-left" : "text-right")}>
          <p className={cn(
            "text-xl font-black uppercase tracking-tight truncate",
            isActive ? "text-white" : "text-white/60"
          )}>
            {name}
          </p>
          <p className={cn(
            "text-6xl font-black tabular-nums leading-none mt-1",
            isActive ? "text-amber-400" : "text-white/50"
          )}>
            {remaining !== null ? remaining : "—"}
          </p>
        </div>
      </div>

      <div className={cn(
        "flex items-center gap-4 mt-3 text-xs font-bold uppercase tracking-widest",
        isLeft ? "flex-row" : "flex-row-reverse"
      )}>
        <div className={cn("text-center", isLeft ? "text-left" : "text-right")}>
          <p className="text-white/30 text-[9px] mb-0.5">Avg</p>
          <p className={cn("text-base font-black tabular-nums", isActive ? "text-white/80" : "text-white/30")}>
            {avg}
          </p>
        </div>
        {lastScore !== null && (
          <div className={cn("text-center", isLeft ? "text-left" : "text-right")}>
            <p className="text-white/30 text-[9px] mb-0.5">Last</p>
            <p className={cn("text-base font-black tabular-nums", isActive ? "text-green-400" : "text-white/30")}>
              +{lastScore}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
