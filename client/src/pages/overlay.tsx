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

const MAROON = "#7B1818";
const GREEN  = "#4B9B3E";

const col = { sets: 58, legs: 58, rem: 96 };
const rowPad = { paddingTop: 12, paddingBottom: 12 };

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
        setData(await res.json());
        setError(false);
      } catch { setError(true); }
    };
    fetchData();
    const interval = setInterval(fetchData, 1000);
    return () => clearInterval(interval);
  }, [matchId]);

  if (error) {
    return (
      <div style={{ background: "transparent" }} className="w-screen h-screen flex items-center justify-center">
        <div className="bg-black/80 text-white px-8 py-4 text-lg font-bold">Match not found</div>
      </div>
    );
  }

  if (!data) return <div style={{ background: "transparent" }} className="w-screen h-screen" />;

  const { tournamentName, roundLabel, formatLabel, playerA, playerB, scoreA, scoreB, live } = data;
  const remainingA     = live?.remainingA     ?? 501;
  const remainingB     = live?.remainingB     ?? 501;
  const currentThrower = live?.currentThrower ?? null;
  const legsWonA       = live?.legsWonA       ?? 0;
  const legsWonB       = live?.legsWonB       ?? 0;
  const playerAName    = playerA?.name        ?? "Player A";
  const playerBName    = playerB?.name        ?? "Player B";

  return (
    <>
      <title>{`Overlay – ${playerAName} vs ${playerBName}`}</title>
      <div style={{ background: "transparent" }} className="w-screen h-screen flex items-center justify-center">

        <div className="flex items-stretch shadow-2xl">

          {/* ── Left maroon bar ── */}
          <div style={{ background: MAROON, minWidth: 180 }} className="flex items-center justify-center px-7">
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 20, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              {roundLabel}
            </span>
          </div>

          {/* ── Main scoreboard ── */}
          <div className="flex flex-col" style={{ minWidth: 560 }}>

            {/* Top bar */}
            <div className="flex items-center justify-between bg-black px-5" style={{ height: 40 }}>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>{formatLabel}</span>
              <div className="flex items-center">
                <div style={{ width: col.sets, textAlign: "center" }}>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>Sets</span>
                </div>
                <div style={{ width: col.legs, textAlign: "center" }}>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>Legs</span>
                </div>
                <div style={{ width: col.rem }} />
              </div>
            </div>

            {/* Middle: white name area + green stats */}
            <div className="flex items-stretch">

              {/* Player names (white bg) */}
              <div className="flex flex-col justify-around flex-1 px-5" style={{ background: "#fff", ...rowPad }}>
                <div className="flex items-center" style={{ height: 44, gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 26, color: "#111", lineHeight: 1 }} className="truncate">
                    {playerAName}
                  </span>
                  {currentThrower === "A" && (
                    <span style={{ color: "#b00000", fontSize: 20, lineHeight: 1 }}>•</span>
                  )}
                </div>
                <div className="flex items-center" style={{ height: 44, gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 26, color: "#111", lineHeight: 1 }} className="truncate">
                    {playerBName}
                  </span>
                  {currentThrower === "B" && (
                    <span style={{ color: "#b00000", fontSize: 20, lineHeight: 1 }}>•</span>
                  )}
                </div>
              </div>

              {/* Green stats */}
              <div className="flex items-stretch" style={{ background: GREEN }}>

                {/* Sets column */}
                <div className="flex flex-col justify-around items-center" style={{ width: col.sets, ...rowPad }}>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: 22 }}>{scoreA}</span>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: 22 }}>{scoreB}</span>
                </div>

                {/* Legs column */}
                <div className="flex flex-col justify-around items-center" style={{ width: col.legs, ...rowPad }}>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: 22 }}>{legsWonA}</span>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: 22 }}>{legsWonB}</span>
                </div>

                {/* Remaining column – larger */}
                <div className="flex flex-col justify-around items-center" style={{ width: col.rem, ...rowPad }}>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: 32, fontVariantNumeric: "tabular-nums" }}>{remainingA}</span>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: 32, fontVariantNumeric: "tabular-nums" }}>{remainingB}</span>
                </div>

              </div>
            </div>

            {/* Bottom bar */}
            <div className="flex items-center bg-black px-5" style={{ height: 34 }}>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 14, letterSpacing: "0.03em" }}>
                {tournamentName}
              </span>
            </div>

          </div>

          {/* ── Right maroon arrow ── */}
          <div style={{ background: MAROON, width: 44 }} className="flex items-center justify-center">
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 22 }}>◀</span>
          </div>

        </div>
      </div>
    </>
  );
}
