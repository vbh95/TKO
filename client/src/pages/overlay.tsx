import { useParams } from "wouter";
import { useEffect, useState } from "react";

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
      <div style={{ background: "transparent" }} className="w-screen h-screen flex items-center justify-center">
        <div className="bg-black/80 text-white px-8 py-4 rounded-lg text-lg font-bold">
          Match not found
        </div>
      </div>
    );
  }

  if (!data) return <div style={{ background: "transparent" }} className="w-screen h-screen" />;

  const { tournamentName, roundLabel, formatLabel, playerA, playerB, scoreA, scoreB, live } = data;

  const remainingA = live?.remainingA ?? 0;
  const remainingB = live?.remainingB ?? 0;
  const legsWonA = live?.legsWonA ?? 0;
  const legsWonB = live?.legsWonB ?? 0;
  const avgA = live?.avgA ?? "-";
  const avgB = live?.avgB ?? "-";

  const playerAName = playerA?.name ?? "Player A";
  const playerBName = playerB?.name ?? "Player B";

  return (
    <>
      <title>{`Overlay – ${playerAName} vs ${playerBName}`}</title>
      <div
        style={{ background: "transparent" }}
        className="w-screen h-screen flex items-center justify-center"
      >
        <div className="flex flex-col gap-0 shadow-2xl" style={{ width: "900px" }}>
          {/* Top Bar - Format Label */}
          <div className="flex items-center justify-between bg-black px-8 py-3">
            <div className="text-white text-2xl font-bold tracking-wider">{formatLabel}</div>
            <div className="text-white text-xl font-bold tracking-wider">
              <span className="mr-16">Sets</span>
              <span>Legs</span>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex items-stretch bg-white/95">
            {/* Left Sidebar - Tournament Info */}
            <div className="bg-amber-900 px-4 py-6 flex flex-col items-center justify-center min-w-[120px]">
              <div className="text-white text-center font-bold text-sm tracking-wider leading-tight">
                <div>T20</div>
                <div>T20</div>
                <div>BULL</div>
              </div>
            </div>

            {/* Center - Player Names */}
            <div className="flex-1 flex flex-col justify-around px-8 py-4">
              <div className="text-gray-800 text-3xl font-bold">{playerAName}</div>
              <div className="text-gray-800 text-3xl font-bold">{playerBName}</div>
            </div>

            {/* Indicator Dot */}
            <div className="flex items-center px-4">
              <div className="w-3 h-3 rounded-full bg-red-600"></div>
            </div>

            {/* Right Stats - Green Panel */}
            <div className="bg-green-600 px-6 py-4 flex items-stretch gap-6">
              {/* Sets Column */}
              <div className="flex flex-col justify-around text-center">
                <div className="text-white font-bold text-sm">{scoreA}</div>
                <div className="text-white font-bold text-sm">{scoreB}</div>
              </div>

              {/* Legs Column */}
              <div className="flex flex-col justify-around text-center">
                <div className="text-white font-bold text-sm">{legsWonA}</div>
                <div className="text-white font-bold text-sm">{legsWonB}</div>
              </div>

              {/* Remaining Column */}
              <div className="flex flex-col justify-around text-center">
                <div className="text-white font-bold text-xl">{remainingA}</div>
                <div className="text-white font-bold text-xl">{remainingB}</div>
              </div>
            </div>

            {/* Right Arrow */}
            <div className="bg-amber-900 px-3 py-4 flex items-center justify-center">
              <div className="text-white text-2xl font-bold">◀</div>
            </div>
          </div>

          {/* Bottom Bar - Competition Name */}
          <div className="bg-black px-8 py-3 text-white text-xl font-bold text-center tracking-wider">
            {tournamentName}
          </div>
        </div>
      </div>
    </>
  );
}
