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

// Column widths
const COL     = { sets: 70, legs: 70, rem: 110 };
const ARROW_W = 44;
// Row height for each player – tall enough that NAME_SZ text never clips
const ROW_H   = 76;
// Font sizes
const NAME_SZ  = 34;  // player names – largest text on the overlay
const STAT_SZ  = 24;  // column headers + top/bottom bar labels
const SCORE_SZ = 32;  // sets, legs AND remaining – all the same size

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

  const TOP_H    = 46;
  const BOTTOM_H = 42;

  return (
    <>
      <title>{`Overlay – ${playerAName} vs ${playerBName}`}</title>
      <div style={{ background: "transparent", position: "fixed", bottom: 20, right: 20 }} className="flex">

        {/* Outer flex row: [main card] [external arrow column] */}
        <div className="flex items-stretch">

          {/* ── MAIN CARD ── */}
          <div className="flex flex-col shadow-2xl">

            {/* ── TOP BAR ──
                [flex-1 name area] [COL.sets] [COL.legs] [COL.rem spacer] */}
            <div className="flex items-center bg-black" style={{ height: TOP_H }}>
              <div className="flex-1 px-4">
                <span style={{ color: "#fff", fontWeight: 700, fontSize: STAT_SZ }}>
                  {topLabel}
                </span>
              </div>
              <div style={{ width: COL.sets, textAlign: "center" }}>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: STAT_SZ }}>Sets</span>
              </div>
              <div style={{ width: COL.legs, textAlign: "center" }}>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: STAT_SZ }}>Legs</span>
              </div>
              <div style={{ width: COL.rem }} />
            </div>

            {/* ── MIDDLE ROW ── */}
            <div className="flex items-stretch">

              {/* Player names (white) – paddingRight creates breathing room before green stats */}
              <div className="flex-1 flex flex-col" style={{ background: "#fff", minWidth: 260 }}>
                <div className="flex items-center" style={{ height: ROW_H, paddingLeft: 16, paddingRight: 180 }}>
                  <span style={{ fontWeight: 700, fontSize: NAME_SZ, color: "#111", lineHeight: 1.4 }} className="truncate">
                    {playerAName}
                  </span>
                </div>
                <div className="flex items-center" style={{ height: ROW_H, paddingLeft: 16, paddingRight: 180 }}>
                  <span style={{ fontWeight: 700, fontSize: NAME_SZ, color: "#111", lineHeight: 1.4 }} className="truncate">
                    {playerBName}
                  </span>
                </div>
              </div>

              {/* Green stats */}
              <div className="flex" style={{ background: GREEN }}>

                {/* Sets */}
                <div className="flex flex-col" style={{ width: COL.sets }}>
                  <div className="flex items-center justify-center" style={{ height: ROW_H }}>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: SCORE_SZ }}>{scoreA}</span>
                  </div>
                  <div className="flex items-center justify-center" style={{ height: ROW_H }}>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: SCORE_SZ }}>{scoreB}</span>
                  </div>
                </div>

                {/* Legs */}
                <div className="flex flex-col" style={{ width: COL.legs }}>
                  <div className="flex items-center justify-center" style={{ height: ROW_H }}>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: SCORE_SZ }}>{legsWonA}</span>
                  </div>
                  <div className="flex items-center justify-center" style={{ height: ROW_H }}>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: SCORE_SZ }}>{legsWonB}</span>
                  </div>
                </div>

                {/* Remaining */}
                <div className="flex flex-col" style={{ width: COL.rem }}>
                  <div className="flex items-center justify-center" style={{ height: ROW_H }}>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: SCORE_SZ }}>{remainingA}</span>
                  </div>
                  <div className="flex items-center justify-center" style={{ height: ROW_H }}>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: SCORE_SZ }}>{remainingB}</span>
                  </div>
                </div>

              </div>

            </div>

            {/* ── BOTTOM BAR ── */}
            <div className="flex items-center bg-black px-4" style={{ height: BOTTOM_H }}>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: STAT_SZ }}>
                {tournamentName}
              </span>
            </div>

          </div>

          {/* ── EXTERNAL ARROW COLUMN (outside the card) ── */}
          <div className="flex flex-col" style={{ width: ARROW_W }}>
            <div style={{ height: TOP_H }} />
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
            <div style={{ height: BOTTOM_H }} />
          </div>

        </div>
      </div>
    </>
  );
}
