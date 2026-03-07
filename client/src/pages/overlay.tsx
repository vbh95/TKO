import { useParams } from "wouter";
import { useEffect, useState } from "react";
import { getCheckoutSuggestion } from "@/lib/checkout";

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

const MAROON       = "#7B1818";
const GREEN        = "#4B9B3E";
const CHECKOUT_RED = "#B91C1C";

const COL        = { sets: 70, legs: 70, rem: 110 };
const ARROW_W    = 44;
const ROW_H      = 76;
const TOP_H      = 46;
const BOTTOM_H   = 42;
const CARD_H     = TOP_H + ROW_H * 2 + BOTTOM_H;
const CHECKOUT_W = 180;

const NAME_SZ  = 34;
const STAT_SZ  = 24;
const SCORE_SZ = 32;
const DART_SZ  = 30;
const DART_HEADER_SZ = 16;

function CheckoutPanel({ darts, playerName, visible }: { darts: string[] | null; playerName: string; visible: boolean }) {
  return (
    <div style={{ overflow: "hidden", width: CHECKOUT_W, flexShrink: 0 }}>
      <div
        style={{
          width: CHECKOUT_W,
          height: CARD_H,
          display: "flex",
          flexDirection: "column",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 300ms ease",
          willChange: "transform",
        }}
      >
        {/* Header – matches TOP_H */}
        <div
          style={{
            height: TOP_H,
            background: "#111",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ color: "#ccc", fontWeight: 700, fontSize: DART_HEADER_SZ, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Checkout
          </span>
        </div>

        {/* Body – red, dart suggestions */}
        <div
          style={{
            flex: 1,
            background: CHECKOUT_RED,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "8px 0",
          }}
        >
          {darts?.map((dart, i) => {
            const isFinal = i === (darts.length - 1);
            return (
              <div
                key={i}
                style={{
                  color: isFinal ? "#FFE066" : "#fff",
                  fontWeight: 800,
                  fontSize: DART_SZ,
                  lineHeight: 1.15,
                  letterSpacing: "0.02em",
                  fontFamily: "inherit",
                }}
              >
                {dart}
              </div>
            );
          })}
        </div>

        {/* Footer – matches BOTTOM_H */}
        <div
          style={{
            height: BOTTOM_H,
            background: "#111",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingLeft: 8,
            paddingRight: 8,
          }}
        >
          <span
            style={{
              color: "#aaa",
              fontWeight: 600,
              fontSize: 13,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
            }}
          >
            {playerName}
          </span>
        </div>
      </div>
    </div>
  );
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

  const activeRemaining  = currentThrower === "A" ? remainingA : currentThrower === "B" ? remainingB : null;
  const activePlayerName = currentThrower === "A" ? playerAName : currentThrower === "B" ? playerBName : "";
  const checkoutDarts    = activeRemaining !== null ? getCheckoutSuggestion(activeRemaining) : null;
  const showCheckout     = checkoutDarts !== null;

  return (
    <>
      <title>{`Overlay – ${playerAName} vs ${playerBName}`}</title>
      <div style={{ background: "transparent", position: "fixed", bottom: 60, right: 60 }} className="flex">

        {/* ── OUTER FLEX ROW: [checkout] [main card] [arrow] ── */}
        <div className="flex items-stretch">

          {/* ── CHECKOUT PANEL (slides out from behind the card to the left) ── */}
          <CheckoutPanel
            darts={checkoutDarts}
            playerName={activePlayerName}
            visible={showCheckout}
          />

          {/* ── MAIN CARD ── */}
          <div className="flex flex-col shadow-2xl">

            {/* TOP BAR */}
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

            {/* MIDDLE ROW */}
            <div className="flex items-stretch">

              {/* Player names */}
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

            {/* BOTTOM BAR */}
            <div className="flex items-center bg-black px-4" style={{ height: BOTTOM_H }}>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: STAT_SZ }}>
                {tournamentName}
              </span>
            </div>

          </div>

          {/* ── EXTERNAL ARROW COLUMN ── */}
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
