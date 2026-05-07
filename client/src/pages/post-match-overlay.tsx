import { useParams } from "wouter";
import { useEffect, useRef, useState } from "react";

interface OverlayData {
  match: {
    id: number;
    playerAId: number | null;
    playerBId: number | null;
    scoreA: number;
    scoreB: number;
    winnerId: number | null;
    bestOf: number;
    roundKey: string;
  } | null;
  playerA: { id: number; name: string } | null;
  playerB: { id: number; name: string } | null;
  tournamentName: string;
  stats: {
    avgA: number | null;
    avgB: number | null;
    ton80sA: number | null;
    ton80sB: number | null;
    ton40sA: number | null;
    ton40sB: number | null;
    tonsA: number | null;
    tonsB: number | null;
    checkoutPctA: number | null;
    checkoutPctB: number | null;
    highestFinishA: number | null;
    highestFinishB: number | null;
    bestLegA: number | null;
    bestLegB: number | null;
  } | null;
  settings: Record<string, any>;
}

const STAT_LABELS: Record<string, string> = {
  average: "3-Dart Avg",
  ton80s: "180s",
  ton40s: "140+",
  tons: "100+",
  checkoutPct: "Checkout %",
  highestCheckout: "Highest Finish",
  bestLeg: "Best Leg",
};

const DEFAULT_SETTINGS = {
  bgColor: "#0f172a",
  bgOpacity: 0.93,
  bgType: "solid" as "solid" | "gradient",
  bgGradientEndColor: "#1e3a5f",
  bgGradientAngle: 135,
  primaryColor: "#7B1818",
  secondaryColor: "#4B9B3E",
  textColor: "#ffffff",
  winnerHighlightColor: "#f59e0b",
  showWinnerStar: true,
  fontFamily: "Outfit, sans-serif",
  titleFontSize: 18,
  playerNameFontSize: 30,
  statsFontSize: 14,
  statRowPadding: 7,
  borderRadius: 14,
  cardWidth: 1400,
  showStats: {
    average: true,
    ton80s: true,
    ton40s: true,
    tons: true,
    checkoutPct: true,
    highestCheckout: true,
    bestLeg: true,
  },
  statOrder: ["average", "ton80s", "ton40s", "tons", "checkoutPct", "highestCheckout", "bestLeg"],
  showSponsorArea: false,
  sponsorLogoUrl: "",
  sponsorLogoUrls: [] as string[],
  sponsorLogoMaxHeight: 48,
  playerAMediaUrl: "",
  playerBMediaUrl: "",
  mediaFit: "cover",
  mediaPosition: "top" as "top" | "side",
  entranceAnimation: "fade-in",
  exitAnimation: "fade-out",
  animationDuration: 800,
  statRevealDelay: 120,
  holdDuration: 15000,
  autoHide: true,
  refreshInterval: 10000,
};

function hexToRgb(hex: string) {
  const h = (hex || "#000000").replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `${r}, ${g}, ${b}`;
}

function cardBackground(s: typeof DEFAULT_SETTINGS): string {
  const bgRgb = hexToRgb(s.bgColor || "#0f172a");
  if (s.bgType === "gradient") {
    const endRgb = hexToRgb(s.bgGradientEndColor || "#1e3a5f");
    return `linear-gradient(${s.bgGradientAngle}deg, rgba(${bgRgb}, ${s.bgOpacity}), rgba(${endRgb}, ${s.bgOpacity}))`;
  }
  return `rgba(${bgRgb}, ${s.bgOpacity})`;
}

function getStatValues(key: string, stats: OverlayData["stats"]) {
  if (!stats) return { a: null, b: null };
  switch (key) {
    case "average": return { a: stats.avgA != null ? stats.avgA.toFixed(1) : null, b: stats.avgB != null ? stats.avgB.toFixed(1) : null };
    case "ton80s": return { a: stats.ton80sA, b: stats.ton80sB };
    case "ton40s": return { a: stats.ton40sA, b: stats.ton40sB };
    case "tons": return { a: stats.tonsA, b: stats.tonsB };
    case "checkoutPct": return { a: stats.checkoutPctA != null ? `${stats.checkoutPctA}%` : null, b: stats.checkoutPctB != null ? `${stats.checkoutPctB}%` : null };
    case "highestCheckout": return { a: stats.highestFinishA, b: stats.highestFinishB };
    case "bestLeg": return { a: stats.bestLegA, b: stats.bestLegB };
    default: return { a: null, b: null };
  }
}

function injectKeyframes() {
  const id = "pmc-keyframes";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    @keyframes pmc-fade-in { from { opacity: 0 } to { opacity: 1 } }
    @keyframes pmc-fade-out { from { opacity: 1 } to { opacity: 0 } }
    @keyframes pmc-slide-up { from { opacity: 0; transform: translateY(60px) } to { opacity: 1; transform: translateY(0) } }
    @keyframes pmc-slide-down { from { opacity: 1; transform: translateY(0) } to { opacity: 0; transform: translateY(60px) } }
    @keyframes pmc-slide-left { from { opacity: 0; transform: translateX(-80px) } to { opacity: 1; transform: translateX(0) } }
    @keyframes pmc-slide-right { from { opacity: 0; transform: translateX(80px) } to { opacity: 1; transform: translateX(0) } }
    @keyframes pmc-zoom-in { from { opacity: 0; transform: scale(0.85) } to { opacity: 1; transform: scale(1) } }
    @keyframes pmc-zoom-out { from { opacity: 1; transform: scale(1) } to { opacity: 0; transform: scale(0.85) } }
    @keyframes pmc-wipe { from { clip-path: inset(0 100% 0 0) } to { clip-path: inset(0 0% 0 0) } }
    @keyframes pmc-stat-reveal { from { opacity: 0; transform: translateX(-16px) } to { opacity: 1; transform: translateX(0) } }
    @keyframes pmc-winner-pulse { 0%,100% { text-shadow: 0 0 0px currentColor } 50% { text-shadow: 0 0 18px currentColor } }
    @keyframes pmc-flip-in { from { opacity: 0; transform: perspective(800px) rotateX(90deg) } to { opacity: 1; transform: perspective(800px) rotateX(0deg) } }
    @keyframes pmc-flip-out { from { opacity: 1; transform: perspective(800px) rotateX(0deg) } to { opacity: 0; transform: perspective(800px) rotateX(-90deg) } }
    @keyframes pmc-drop-in { from { opacity: 0; transform: translateY(-80px) } to { opacity: 1; transform: translateY(0) } }
    @keyframes pmc-blur-in { from { opacity: 0; filter: blur(18px) } to { opacity: 1; filter: blur(0px) } }
    @keyframes pmc-blur-out { from { opacity: 1; filter: blur(0px) } to { opacity: 0; filter: blur(18px) } }
    @keyframes pmc-bounce-in {
      0%   { opacity: 0; transform: scale(0.7) }
      60%  { opacity: 1; transform: scale(1.06) }
      80%  { transform: scale(0.97) }
      100% { transform: scale(1) }
    }
  `;
  document.head.appendChild(style);
}

function getEntranceAnim(name: string, duration: number): string {
  const ms = `${duration}ms`;
  const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
  switch (name) {
    case "slide-up":         return `pmc-slide-up ${ms} ${ease} both`;
    case "slide-from-left":  return `pmc-slide-left ${ms} ${ease} both`;
    case "slide-from-right": return `pmc-slide-right ${ms} ${ease} both`;
    case "zoom-in":          return `pmc-zoom-in ${ms} ${ease} both`;
    case "wipe-reveal":      return `pmc-wipe ${ms} ${ease} both`;
    case "flip-in":          return `pmc-flip-in ${ms} ${ease} both`;
    case "drop-in":          return `pmc-drop-in ${ms} ${ease} both`;
    case "blur-in":          return `pmc-blur-in ${ms} ease both`;
    case "bounce-in":        return `pmc-bounce-in ${ms} ease both`;
    default:                 return `pmc-fade-in ${ms} ease both`;
  }
}

function getExitAnim(name: string, duration: number): string {
  const ms = `${duration}ms`;
  switch (name) {
    case "zoom-out":   return `pmc-zoom-out ${ms} ease both`;
    case "slide-down": return `pmc-slide-down ${ms} cubic-bezier(0.22, 1, 0.36, 1) both`;
    case "flip-out":   return `pmc-flip-out ${ms} ease both`;
    case "blur-out":   return `pmc-blur-out ${ms} ease both`;
    default:           return `pmc-fade-out ${ms} ease both`;
  }
}

export default function PostMatchOverlay() {
  const { tournamentId, boardNumber } = useParams<{ tournamentId: string; boardNumber: string }>();
  const [data, setData] = useState<OverlayData | null>(null);
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [lastMatchId, setLastMatchId] = useState<number | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rawS = data?.settings ? { ...DEFAULT_SETTINGS, ...data.settings } : DEFAULT_SETTINGS;
  // Backwards compat: migrate single sponsorLogoUrl → sponsorLogoUrls
  const s: typeof DEFAULT_SETTINGS = (() => {
    const merged = { ...rawS };
    if ((!merged.sponsorLogoUrls || (merged.sponsorLogoUrls as string[]).length === 0) && merged.sponsorLogoUrl) {
      merged.sponsorLogoUrls = [merged.sponsorLogoUrl] as string[];
    }
    return merged as typeof DEFAULT_SETTINGS;
  })();

  const showStats = s.showStats as Record<string, boolean>;
  const statOrder = s.statOrder as string[];
  const visibleStats = statOrder.filter(k => showStats[k]);

  useEffect(() => {
    injectKeyframes();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  const scheduleHide = (cfg: typeof DEFAULT_SETTINGS) => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (!cfg.autoHide) return;
    hideTimerRef.current = setTimeout(() => {
      setExiting(true);
      setTimeout(() => { setVisible(false); setExiting(false); }, cfg.animationDuration);
    }, cfg.holdDuration);
  };

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/boards/${boardNumber}/last-completed-match`);
      if (!res.ok) return;
      const json: OverlayData = await res.json();
      setData(json);

      if (json.match && json.match.id !== lastMatchId) {
        setLastMatchId(json.match.id);
        setExiting(false);
        setVisible(true);
        const cfg = { ...DEFAULT_SETTINGS, ...(json.settings ?? {}) } as typeof DEFAULT_SETTINGS;
        scheduleHide(cfg);
      }
    } catch {}
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!data) return;
    const cfg = { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) } as typeof DEFAULT_SETTINGS;
    const interval = Math.max(cfg.refreshInterval, 3000);
    pollTimerRef.current = setTimeout(function poll() {
      fetchData().finally(() => {
        pollTimerRef.current = setTimeout(poll, interval);
      });
    }, interval);
    return () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); };
  }, [data?.settings, lastMatchId]);

  if (!visible || !data?.match) {
    return (
      <div style={{ width: "1920px", height: "1080px", background: "transparent", position: "relative", overflow: "hidden" }} />
    );
  }

  const { match, playerA, playerB, stats } = data;
  const isWinnerA = match.winnerId === match.playerAId;
  const isWinnerB = match.winnerId === match.playerBId;

  const cardAnim = exiting
    ? getExitAnim(s.exitAnimation, s.animationDuration)
    : getEntranceAnim(s.entranceAnimation, s.animationDuration);

  const cardBg = cardBackground(s);

  const hasMediaA = !!s.playerAMediaUrl;
  const hasMediaB = !!s.playerBMediaUrl;
  const hasMedia = hasMediaA || hasMediaB;
  const isSide = s.mediaPosition === "side";

  const isVideo = (url: string) => /\.(mp4|webm|ogg)(\?|$)/i.test(url);

  const mediaH = hasMedia && !isSide ? 340 : 0;

  const logoUrls = (s.sponsorLogoUrls as string[]).filter(Boolean);

  const renderMedia = (url: string, name: string | undefined) => {
    if (!url) return null;
    return isVideo(url)
      ? <video src={url} autoPlay loop muted playsInline style={{ width: "100%", height: "100%", objectFit: s.mediaFit as any, display: "block" }} />
      : <img src={url} alt={name} style={{ width: "100%", height: "100%", objectFit: s.mediaFit as any, display: "block" }} />;
  };

  /* ─── Stats + sponsor content (shared by both layouts) ─────────── */
  const headerPad = (hasMedia && !isSide) ? "10px 40px 0" : "28px 40px 0";

  const statsContent = (
    <>
      {/* Tournament name */}
      <div style={{
        textAlign: "center",
        padding: headerPad,
        color: `rgba(${hexToRgb(s.textColor)}, 0.6)`,
        fontSize: s.titleFontSize,
        fontWeight: 600,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
      }}>
        {data.tournamentName}
      </div>

      {/* Score row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 40px 0", gap: 20 }}>
        {/* Player A name */}
        <div style={{
          flex: 1,
          textAlign: "right",
          color: isWinnerA ? s.winnerHighlightColor : s.textColor,
          fontSize: s.playerNameFontSize,
          fontWeight: 800,
          letterSpacing: "0.02em",
          animation: isWinnerA ? `pmc-winner-pulse 2.4s ease-in-out infinite` : undefined,
        }}>
          {playerA?.name ?? "Player A"}
          {isWinnerA && s.showWinnerStar && (
            <span style={{ marginLeft: 10, fontSize: s.playerNameFontSize * 0.6, opacity: 0.85 }}>★</span>
          )}
        </div>

        {/* Score */}
        <div style={{
          display: "flex", alignItems: "center", gap: 0,
          background: `rgba(255,255,255,0.07)`,
          borderRadius: 10, overflow: "hidden",
          minWidth: 160, flexShrink: 0,
        }}>
          <div style={{
            flex: 1, textAlign: "center", padding: "10px 20px",
            fontSize: s.playerNameFontSize * 1.1, fontWeight: 900,
            color: isWinnerA ? s.winnerHighlightColor : s.textColor,
            background: isWinnerA ? `rgba(${hexToRgb(s.winnerHighlightColor)}, 0.1)` : "transparent",
          }}>
            {match.scoreA}
          </div>
          <div style={{ width: 2, background: `rgba(255,255,255,0.12)`, alignSelf: "stretch" }} />
          <div style={{
            flex: 1, textAlign: "center", padding: "10px 20px",
            fontSize: s.playerNameFontSize * 1.1, fontWeight: 900,
            color: isWinnerB ? s.winnerHighlightColor : s.textColor,
            background: isWinnerB ? `rgba(${hexToRgb(s.winnerHighlightColor)}, 0.1)` : "transparent",
          }}>
            {match.scoreB}
          </div>
        </div>

        {/* Player B name */}
        <div style={{
          flex: 1,
          textAlign: "left",
          color: isWinnerB ? s.winnerHighlightColor : s.textColor,
          fontSize: s.playerNameFontSize,
          fontWeight: 800,
          letterSpacing: "0.02em",
          animation: isWinnerB ? `pmc-winner-pulse 2.4s ease-in-out infinite` : undefined,
        }}>
          {isWinnerB && s.showWinnerStar && (
            <span style={{ marginRight: 10, fontSize: s.playerNameFontSize * 0.6, opacity: 0.85 }}>★</span>
          )}
          {playerB?.name ?? "Player B"}
        </div>
      </div>

      {/* Divider */}
      <div style={{
        margin: "14px 40px", height: 1,
        background: `linear-gradient(to right, transparent, rgba(${hexToRgb(s.primaryColor)}, 0.6), rgba(${hexToRgb(s.secondaryColor)}, 0.6), transparent)`,
      }} />

      {/* Stats rows */}
      <div style={{ padding: "0 40px", paddingBottom: s.showSponsorArea ? 16 : 28 }}>
        {visibleStats.map((statKey, idx) => {
          const vals = getStatValues(statKey, stats);
          const anim = s.entranceAnimation === "staggered"
            ? `pmc-stat-reveal ${s.animationDuration}ms cubic-bezier(0.22,1,0.36,1) ${s.statRevealDelay * (idx + 1)}ms both`
            : undefined;
          return (
            <div
              key={statKey}
              style={{
                display: "flex", alignItems: "center",
                padding: `${s.statRowPadding}px 0`,
                borderBottom: idx < visibleStats.length - 1 ? `1px solid rgba(255,255,255,0.06)` : "none",
                animation: anim,
              }}
            >
              <div style={{ flex: 1, textAlign: "right", fontSize: s.statsFontSize + 2, fontWeight: 700, color: s.textColor, paddingRight: 20 }}>
                {vals.a != null ? String(vals.a) : "—"}
              </div>
              <div style={{
                width: 200, textAlign: "center",
                fontSize: s.statsFontSize, fontWeight: 500,
                color: `rgba(${hexToRgb(s.textColor)}, 0.5)`,
                textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0,
              }}>
                {STAT_LABELS[statKey] ?? statKey}
              </div>
              <div style={{ flex: 1, textAlign: "left", fontSize: s.statsFontSize + 2, fontWeight: 700, color: s.textColor, paddingLeft: 20 }}>
                {vals.b != null ? String(vals.b) : "—"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sponsor area */}
      {s.showSponsorArea && (
        <div style={{
          borderTop: `1px solid rgba(255,255,255,0.08)`,
          padding: "12px 40px 20px",
          display: "flex", justifyContent: "center", alignItems: "center",
          gap: 24, minHeight: 60,
        }}>
          {logoUrls.length > 0
            ? logoUrls.map((url, i) => (
                <img key={i} src={url} alt={`Sponsor ${i + 1}`}
                  style={{ maxHeight: s.sponsorLogoMaxHeight, maxWidth: 280, objectFit: "contain" }} />
              ))
            : <div style={{ color: `rgba(${hexToRgb(s.textColor)}, 0.25)`, fontSize: 13, fontStyle: "italic" }}>
                Sponsor area
              </div>}
        </div>
      )}
    </>
  );

  /* ─── Side layout ─────────────────────────────────────────────── */
  if (isSide) {
    const sideW = 360;
    return (
      <div style={{
        width: "1920px", height: "1080px",
        background: "transparent",
        display: "flex", alignItems: "center",
        fontFamily: s.fontFamily, position: "relative", overflow: "hidden",
      }}>
        {/* Left: Player A */}
        <div style={{ width: sideW, height: 1080, flexShrink: 0, position: "relative", overflow: "hidden" }}>
          {hasMediaA
            ? renderMedia(s.playerAMediaUrl, playerA?.name)
            : <div style={{ width: "100%", height: "100%", background: `rgba(${hexToRgb(s.primaryColor)}, 0.2)` }} />}
          <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 180, background: `linear-gradient(to right, transparent, ${cardBg})` }} />
        </div>

        {/* Centre: card */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", height: 1080 }}>
          <div style={{
            width: Math.min(s.cardWidth, 1920 - sideW * 2),
            background: cardBg,
            borderRadius: s.borderRadius,
            overflow: "hidden",
            animation: cardAnim,
            boxShadow: "0 8px 48px rgba(0,0,0,0.7)",
            border: `1px solid rgba(255,255,255,0.08)`,
          }}>
            {statsContent}
          </div>
        </div>

        {/* Right: Player B */}
        <div style={{ width: sideW, height: 1080, flexShrink: 0, position: "relative", overflow: "hidden" }}>
          {hasMediaB
            ? renderMedia(s.playerBMediaUrl, playerB?.name)
            : <div style={{ width: "100%", height: "100%", background: `rgba(${hexToRgb(s.secondaryColor)}, 0.2)` }} />}
          <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 180, background: `linear-gradient(to left, transparent, ${cardBg})` }} />
        </div>
      </div>
    );
  }

  /* ─── Top layout (default) ────────────────────────────────────── */
  return (
    <div style={{
      width: "1920px", height: "1080px",
      background: "transparent",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: s.fontFamily, position: "relative", overflow: "hidden",
    }}>
      <div style={{
        width: s.cardWidth,
        background: cardBg,
        borderRadius: s.borderRadius,
        overflow: "hidden",
        animation: cardAnim,
        boxShadow: "0 8px 48px rgba(0,0,0,0.7)",
        border: `1px solid rgba(255,255,255,0.08)`,
      }}>
        {/* Top media strip */}
        {hasMedia && (
          <div style={{ display: "flex", height: mediaH, width: "100%" }}>
            <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "#000" }}>
              {hasMediaA
                ? renderMedia(s.playerAMediaUrl, playerA?.name)
                : <div style={{ width: "100%", height: "100%", background: `rgba(${hexToRgb(s.primaryColor)}, 0.15)` }} />}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, background: `linear-gradient(transparent, ${cardBg})` }} />
            </div>
            <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "#000" }}>
              {hasMediaB
                ? renderMedia(s.playerBMediaUrl, playerB?.name)
                : <div style={{ width: "100%", height: "100%", background: `rgba(${hexToRgb(s.secondaryColor)}, 0.15)` }} />}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, background: `linear-gradient(transparent, ${cardBg})` }} />
            </div>
          </div>
        )}
        {statsContent}
      </div>
    </div>
  );
}
