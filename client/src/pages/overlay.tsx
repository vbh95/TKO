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
  useSets: boolean;
  winnerId: number | null;
  playerA: { id: number; name: string } | null;
  playerB: { id: number; name: string } | null;
  scoreA: number;
  scoreB: number;
  live: {
    remainingA: number;
    remainingB: number;
    currentThrower: "A" | "B";
    legStartingThrower: "A" | "B" | null;
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

type OverlayMode = "live" | "winner" | "idle";

const MAROON       = "#7B1818";
const GREEN        = "#4B9B3E";
const CHECKOUT_RED = "#8B1A1A";

const COL        = { sets: 70, legs: 70, rem: 110 };
const ARROW_W    = 44;
const ROW_H      = 76;
const TOP_H      = 46;
const BOTTOM_H   = 42;
const CARD_H     = TOP_H + ROW_H * 2 + BOTTOM_H;
const CHECKOUT_W = 240;

const NAME_SZ    = 34;
const STAT_SZ    = 24;
const SCORE_SZ   = 32;
const DART_SZ    = 26;

function PlayerCheckoutRow({ darts, visible }: { darts: string[] | null; visible: boolean }) {
  return (
    <div style={{ overflow: "hidden", width: CHECKOUT_W, flexShrink: 0 }}>
      <div
        style={{
          width: CHECKOUT_W,
          height: ROW_H,
          background: CHECKOUT_RED,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-evenly",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 300ms ease",
          willChange: "transform",
        }}
      >
        {(darts ?? []).map((dart, i) => (
          <span
            key={i}
            style={{
              color: "#fff",
              fontWeight: 800,
              fontSize: DART_SZ,
              letterSpacing: "0.02em",
              whiteSpace: "nowrap",
              flex: 1,
              textAlign: "center",
            }}
          >
            {dart}
          </span>
        ))}
      </div>
    </div>
  );
}

function WinnerPanel({
  visible,
  winnerName,
  topLabel,
  tournamentName,
}: {
  visible: boolean;
  winnerName: string;
  topLabel: string;
  tournamentName: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 500,
        height: CARD_H,
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1)" : "scale(0.96)",
        transition: "opacity 450ms ease, transform 450ms ease",
        pointerEvents: visible ? "auto" : "none",
        shadow: "0 4px 32px rgba(0,0,0,0.5)",
      }}
    >
      {/* Top bar — matches live overlay top bar */}
      <div
        style={{
          height: TOP_H,
          background: "#000",
          display: "flex",
          alignItems: "center",
          paddingLeft: 20,
          paddingRight: 20,
        }}
      >
        <span style={{ color: "#aaa", fontWeight: 700, fontSize: STAT_SZ }}>
          {topLabel}
        </span>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          background: "#111",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          borderLeft: "4px solid #C41E3A",
          borderRight: "4px solid #C41E3A",
        }}
      >
        <span
          style={{
            color: "#C41E3A",
            fontWeight: 800,
            fontSize: 22,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            lineHeight: 1,
          }}
        >
          Winner
        </span>
        <span
          style={{
            color: "#fff",
            fontWeight: 800,
            fontSize: 44,
            lineHeight: 1.15,
            textAlign: "center",
            paddingLeft: 24,
            paddingRight: 24,
          }}
        >
          {winnerName}
        </span>
      </div>

      {/* Bottom bar — matches live overlay bottom bar */}
      <div
        style={{
          height: BOTTOM_H,
          background: "#000",
          display: "flex",
          alignItems: "center",
          paddingLeft: 20,
          paddingRight: 20,
        }}
      >
        <span style={{ color: "#aaa", fontWeight: 700, fontSize: STAT_SZ }}>
          {tournamentName}
        </span>
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

  const { tournamentName, roundLabel, bestOf, matchNumber, useSets, winnerId, playerA, playerB, scoreA, scoreB, live } = data;

  const overlayMode: OverlayMode =
    data.status === "IN_PROGRESS" ? "live" :
    data.status === "COMPLETED"   ? "winner" :
    "idle";

  const remainingA         = live?.remainingA         ?? 501;
  const remainingB         = live?.remainingB         ?? 501;
  const currentThrower     = live?.currentThrower     ?? null;
  const legStartingThrower = live?.legStartingThrower ?? null;
  const legsWonA           = live?.legsWonA           ?? 0;
  const legsWonB           = live?.legsWonB           ?? 0;
  const playerAName        = playerA?.name            ?? "Player A";
  const playerBName        = playerB?.name            ?? "Player B";

  const topLabel = `${roundLabel} ${matchNumber} – Best of ${bestOf}`;

  const winnerName =
    winnerId === playerA?.id ? playerAName :
    winnerId === playerB?.id ? playerBName :
    scoreA > scoreB          ? playerAName :
    playerBName;

  const isLive   = overlayMode === "live";
  const isWinner = overlayMode === "winner";

  const checkoutA    = getCheckoutSuggestion(remainingA);
  const checkoutB    = getCheckoutSuggestion(remainingB);
  const showCheckoutA = isLive && currentThrower === "A" && checkoutA !== null;
  const showCheckoutB = isLive && currentThrower === "B" && checkoutB !== null;

  return (
    <>
      <title>{`Overlay – ${playerAName} vs ${playerBName}`}</title>

      {/*
        Outer fixed wrapper.
        Both panels share the same grid cell so they cross-fade cleanly
        without any layout jump.
      */}
      <div
        style={{
          background: "transparent",
          position: "fixed",
          bottom: 60,
          right: 60,
          display: "grid",
        }}
      >

        {/* ── LIVE SCOREBOARD ── fades out when match is complete */}
        <div
          style={{
            gridColumn: 1,
            gridRow: 1,
            display: "flex",
            alignItems: "stretch",
            opacity: isLive ? 1 : 0,
            transition: "opacity 450ms ease",
            pointerEvents: isLive ? "auto" : "none",
          }}
        >
          {/* Checkout column */}
          <div className="flex flex-col">
            <div style={{ height: TOP_H }} />
            <PlayerCheckoutRow darts={checkoutA} visible={showCheckoutA} />
            <PlayerCheckoutRow darts={checkoutB} visible={showCheckoutB} />
            <div style={{ height: BOTTOM_H }} />
          </div>

          {/* Main card */}
          <div className="flex flex-col shadow-2xl">

            {/* Top bar */}
            <div className="flex items-center bg-black" style={{ height: TOP_H }}>
              <div className="flex-1 px-4">
                <span style={{ color: "#fff", fontWeight: 700, fontSize: STAT_SZ }}>
                  {topLabel}
                </span>
              </div>
              {useSets && (
                <div style={{ width: COL.sets, textAlign: "center" }}>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: STAT_SZ }}>Sets</span>
                </div>
              )}
              <div style={{ width: COL.legs, textAlign: "center" }}>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: STAT_SZ }}>Legs</span>
              </div>
              <div style={{ width: COL.rem }} />
            </div>

            {/* Middle row */}
            <div className="flex items-stretch">

              {/* Player names */}
              <div className="flex-1 flex flex-col" style={{ background: "#fff", minWidth: 260 }}>
                <div className="flex items-center" style={{ height: ROW_H, paddingLeft: 16, paddingRight: 180 }}>
                  <span style={{ fontWeight: 700, fontSize: NAME_SZ, color: "#111", lineHeight: 1.4 }} className="truncate">
                    {playerAName}
                  </span>
                  {legStartingThrower === "A" && (
                    <span style={{ flexShrink: 0, width: 14, height: 14, borderRadius: "50%", background: "#C41E3A", marginLeft: 14, display: "inline-block" }} />
                  )}
                </div>
                <div className="flex items-center" style={{ height: ROW_H, paddingLeft: 16, paddingRight: 180 }}>
                  <span style={{ fontWeight: 700, fontSize: NAME_SZ, color: "#111", lineHeight: 1.4 }} className="truncate">
                    {playerBName}
                  </span>
                  {legStartingThrower === "B" && (
                    <span style={{ flexShrink: 0, width: 14, height: 14, borderRadius: "50%", background: "#C41E3A", marginLeft: 14, display: "inline-block" }} />
                  )}
                </div>
              </div>

              {/* Green stats */}
              <div className="flex" style={{ background: GREEN }}>

                {useSets && (
                  <div className="flex flex-col" style={{ width: COL.sets }}>
                    <div className="flex items-center justify-center" style={{ height: ROW_H }}>
                      <span style={{ color: "#fff", fontWeight: 700, fontSize: SCORE_SZ }}>{scoreA}</span>
                    </div>
                    <div className="flex items-center justify-center" style={{ height: ROW_H }}>
                      <span style={{ color: "#fff", fontWeight: 700, fontSize: SCORE_SZ }}>{scoreB}</span>
                    </div>
                  </div>
                )}

                <div className="flex flex-col" style={{ width: COL.legs }}>
                  <div className="flex items-center justify-center" style={{ height: ROW_H }}>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: SCORE_SZ }}>{legsWonA}</span>
                  </div>
                  <div className="flex items-center justify-center" style={{ height: ROW_H }}>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: SCORE_SZ }}>{legsWonB}</span>
                  </div>
                </div>

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

            {/* Bottom bar */}
            <div className="flex items-center bg-black px-4" style={{ height: BOTTOM_H }}>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: STAT_SZ }}>
                {tournamentName}
              </span>
            </div>

          </div>

          {/* Arrow column */}
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

        {/* ── WINNER PANEL ── fades in when match is complete, same grid cell */}
        <div
          style={{
            gridColumn: 1,
            gridRow: 1,
            alignSelf: "end",
            justifySelf: "end",
          }}
        >
          <WinnerPanel
            visible={isWinner}
            winnerName={winnerName}
            topLabel={topLabel}
            tournamentName={tournamentName}
          />
        </div>

      </div>
    </>
  );
}
