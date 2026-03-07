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

// Column widths – identical in header row AND data rows
const COL   = { sets: 70, legs: 70, rem: 110, arrow: 44 };
// Row height for each player
const ROW_H = 58;
// Font sizes
const NUM_SZ   = 32;  // all numeric data: Sets, Legs, Remaining
const LABEL_SZ = 16;  // all label text: column headers, top bar, bottom bar

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

  const topLabel = `${roundLabel} ${matchNumber} – Best of ${bestOf}`;

  return (
    <>
      <title>{`Overlay – ${playerAName} vs ${playerBName}`}</title>
      <div style={{ background: "transparent" }} className="w-screen h-screen flex items-center justify-center">

        <div className="flex flex-col shadow-2xl">

          {/* ── TOP BAR ──
              Must mirror the middle row's column structure exactly:
              [flex-1 name area] [COL.sets] [COL.legs] [COL.rem] [COL.arrow]
              This guarantees Sets/Legs headers sit directly above their data. */}
          <div className="flex items-center bg-black" style={{ height: 38 }}>
            <div className="flex-1 px-4">
              <span style={{ color: "#fff", fontWeight: 700, fontSize: LABEL_SZ }}>
                {topLabel}
              </span>
            </div>
            <div style={{ width: COL.sets, textAlign: "center" }}>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: LABEL_SZ }}>Sets</span>
            </div>
            <div style={{ width: COL.legs, textAlign: "center" }}>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: LABEL_SZ }}>Legs</span>
            </div>
            {/* no header for Remaining or arrow */}
            <div style={{ width: COL.rem + COL.arrow }} />
          </div>

          {/* ── MIDDLE ROW ── */}
          <div className="flex items-stretch">

            {/* Player names (white) */}
            <div className="flex-1 flex flex-col" style={{ background: "#fff" }}>
              <div className="flex items-center px-4" style={{ height: ROW_H }}>
                <span style={{ fontWeight: 700, fontSize: 26, color: "#111", lineHeight: 1 }} className="truncate">
                  {playerAName}
                </span>
                {currentThrower === "A" && (
                  <span style={{ color: "#b00000", fontSize: 18, lineHeight: 1, marginLeft: 8 }}>•</span>
                )}
              </div>
              <div className="flex items-center px-4" style={{ height: ROW_H }}>
                <span style={{ fontWeight: 700, fontSize: 26, color: "#111", lineHeight: 1 }} className="truncate">
                  {playerBName}
                </span>
                {currentThrower === "B" && (
                  <span style={{ color: "#b00000", fontSize: 18, lineHeight: 1, marginLeft: 8 }}>•</span>
                )}
              </div>
            </div>

            {/* Green stats */}
            <div className="flex" style={{ background: GREEN }}>

              {/* Sets */}
              <div className="flex flex-col" style={{ width: COL.sets }}>
                <div className="flex items-center justify-center" style={{ height: ROW_H }}>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: NUM_SZ }}>{scoreA}</span>
                </div>
                <div className="flex items-center justify-center" style={{ height: ROW_H }}>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: NUM_SZ }}>{scoreB}</span>
                </div>
              </div>

              {/* Legs */}
              <div className="flex flex-col" style={{ width: COL.legs }}>
                <div className="flex items-center justify-center" style={{ height: ROW_H }}>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: NUM_SZ }}>{legsWonA}</span>
                </div>
                <div className="flex items-center justify-center" style={{ height: ROW_H }}>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: NUM_SZ }}>{legsWonB}</span>
                </div>
              </div>

              {/* Remaining */}
              <div className="flex flex-col" style={{ width: COL.rem }}>
                <div className="flex items-center justify-center" style={{ height: ROW_H }}>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: NUM_SZ }}>{remainingA}</span>
                </div>
                <div className="flex items-center justify-center" style={{ height: ROW_H }}>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: NUM_SZ }}>{remainingB}</span>
                </div>
              </div>

            </div>

            {/* Arrow – per player, active thrower only */}
            <div className="flex flex-col" style={{ width: COL.arrow }}>
              <div
                className="flex items-center justify-center"
                style={{ height: ROW_H, background: currentThrower === "A" ? MAROON : "transparent" }}
              >
                {currentThrower === "A" && (
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: 20 }}>◀</span>
                )}
              </div>
              <div
                className="flex items-center justify-center"
                style={{ height: ROW_H, background: currentThrower === "B" ? MAROON : "transparent" }}
              >
                {currentThrower === "B" && (
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: 20 }}>◀</span>
                )}
              </div>
            </div>

          </div>

          {/* ── BOTTOM BAR ── */}
          <div className="flex items-center bg-black px-4" style={{ height: 34 }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: LABEL_SZ }}>
              {tournamentName}
            </span>
          </div>

        </div>
      </div>
    </>
  );
}
