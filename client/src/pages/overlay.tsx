import { useParams } from "wouter";
import { useEffect, useState } from "react";

interface LiveOverlayData {
  matchId: number;
  status: string;
  tournamentName: string;
  roundLabel: string;
  formatLabel: string;
  bestOf: number;
  matchNumber: number;
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

// Column widths – shared between header row and data rows
const COL = { sets: 62, legs: 62, rem: 100 };
// Each player row height
const ROW_H = 54;

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

  const { tournamentName, roundLabel, bestOf, matchNumber, playerA, playerB, scoreA, scoreB, live } = data;

  const remainingA     = live?.remainingA     ?? 501;
  const remainingB     = live?.remainingB     ?? 501;
  const currentThrower = live?.currentThrower ?? null;
  const legsWonA       = live?.legsWonA       ?? 0;
  const legsWonB       = live?.legsWonB       ?? 0;
  const playerAName    = playerA?.name        ?? "Player A";
  const playerBName    = playerB?.name        ?? "Player B";

  const topLabel = `${roundLabel} ${matchNumber} - Best of ${bestOf}`;

  const statSz = 22;   // Sets / Legs number font size
  const remSz  = 32;   // Remaining number font size

  return (
    <>
      <title>{`Overlay – ${playerAName} vs ${playerBName}`}</title>
      <div style={{ background: "transparent" }} className="w-screen h-screen flex items-center justify-center">

        <div className="flex items-stretch shadow-2xl">

          {/* ── Left maroon bar ── */}
          <div style={{ background: MAROON, minWidth: 160 }} className="flex items-center justify-center px-6">
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 18, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {roundLabel}
            </span>
          </div>

          {/* ── Main scoreboard ── */}
          <div className="flex flex-col" style={{ minWidth: 540 }}>

            {/* ── Top bar ──
                Uses same flex structure as the middle row so columns align perfectly.
                flex-1 here matches flex-1 of the white names area below. */}
            <div className="flex items-center bg-black" style={{ height: 38 }}>
              {/* Spacer matching white name column width */}
              <div className="flex-1 px-4">
                <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{topLabel}</span>
              </div>
              {/* Sets header – exact same width as Sets data column */}
              <div style={{ width: COL.sets, textAlign: "center" }}>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: statSz }}> Sets</span>
              </div>
              {/* Legs header – exact same width as Legs data column */}
              <div style={{ width: COL.legs, textAlign: "center" }}>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: statSz }}>Legs</span>
              </div>
              {/* Spacer for remaining column (no header) */}
              <div style={{ width: COL.rem }} />
            </div>

            {/* ── Middle row: white names | green stats | per-player arrow ── */}
            <div className="flex items-stretch">

              {/* White player-name column */}
              <div className="flex-1 flex flex-col" style={{ background: "#fff" }}>
                {/* Player A */}
                <div className="flex items-center px-4" style={{ height: ROW_H }}>
                  <span style={{ fontWeight: 700, fontSize: 26, color: "#111", lineHeight: 1 }} className="truncate">
                    {playerAName}
                  </span>
                  {currentThrower === "A" && (
                    <span style={{ color: "#b00000", fontSize: 18, lineHeight: 1, marginLeft: 8 }}>•</span>
                  )}
                </div>
                {/* Player B */}
                <div className="flex items-center px-4" style={{ height: ROW_H }}>
                  <span style={{ fontWeight: 700, fontSize: 26, color: "#111", lineHeight: 1 }} className="truncate">
                    {playerBName}
                  </span>
                  {currentThrower === "B" && (
                    <span style={{ color: "#b00000", fontSize: 18, lineHeight: 1, marginLeft: 8 }}>•</span>
                  )}
                </div>
              </div>

              {/* Green stats – Sets | Legs | Remaining */}
              <div className="flex" style={{ background: GREEN }}>

                {/* Sets */}
                <div className="flex flex-col" style={{ width: COL.sets }}>
                  <div className="flex items-center justify-center" style={{ height: ROW_H }}>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: statSz }}>{scoreA}</span>
                  </div>
                  <div className="flex items-center justify-center" style={{ height: ROW_H }}>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: statSz }}>{scoreB}</span>
                  </div>
                </div>

                {/* Legs */}
                <div className="flex flex-col" style={{ width: COL.legs }}>
                  <div className="flex items-center justify-center" style={{ height: ROW_H }}>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: statSz }}>{legsWonA}</span>
                  </div>
                  <div className="flex items-center justify-center" style={{ height: ROW_H }}>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: statSz }}>{legsWonB}</span>
                  </div>
                </div>

                {/* Remaining */}
                <div className="flex flex-col" style={{ width: COL.rem }}>
                  <div className="flex items-center justify-center" style={{ height: ROW_H }}>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: remSz }}>{remainingA}</span>
                  </div>
                  <div className="flex items-center justify-center" style={{ height: ROW_H }}>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: remSz }}>{remainingB}</span>
                  </div>
                </div>

              </div>

              {/* Per-player arrow column – only lights up for active thrower */}
              <div className="flex flex-col" style={{ width: 44 }}>
                <div
                  className="flex items-center justify-center"
                  style={{ height: ROW_H, background: currentThrower === "A" ? MAROON : "transparent" }}
                >
                  {currentThrower === "A" && (
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: 22 }}>◀</span>
                  )}
                </div>
                <div
                  className="flex items-center justify-center"
                  style={{ height: ROW_H, background: currentThrower === "B" ? MAROON : "transparent" }}
                >
                  {currentThrower === "B" && (
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: 22 }}>◀</span>
                  )}
                </div>
              </div>

            </div>

            {/* ── Bottom bar ── */}
            <div className="flex items-center bg-black px-4" style={{ height: 32 }}>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 13, letterSpacing: "0.03em" }}>
                {tournamentName}
              </span>
            </div>

          </div>

        </div>
      </div>
    </>
  );
}
