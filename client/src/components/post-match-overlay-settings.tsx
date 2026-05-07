import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ChevronUp, ChevronDown, Save, Loader2, Plus, Trash2 } from "lucide-react";

const STAT_LABELS: Record<string, string> = {
  average: "3-Dart Avg",
  ton80s: "180s",
  ton40s: "140+",
  tons: "100+",
  checkoutPct: "Checkout %",
  highestCheckout: "Highest Finish",
  bestLeg: "Best Leg (darts)",
};

const FONT_OPTIONS = [
  { value: "Outfit, sans-serif", label: "Outfit" },
  { value: "Plus Jakarta Sans, sans-serif", label: "Plus Jakarta Sans" },
  { value: "Inter, sans-serif", label: "Inter" },
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "Courier New, monospace", label: "Courier New" },
];

const ANIMATION_OPTIONS = [
  { value: "fade-in", label: "Fade In" },
  { value: "slide-up", label: "Slide Up" },
  { value: "slide-from-left", label: "Slide From Left" },
  { value: "slide-from-right", label: "Slide From Right" },
  { value: "zoom-in", label: "Zoom In" },
  { value: "wipe-reveal", label: "Wipe Reveal" },
  { value: "staggered", label: "Staggered Stat Reveal" },
  { value: "flip-in", label: "Flip In" },
  { value: "drop-in", label: "Drop In" },
  { value: "blur-in", label: "Blur In" },
  { value: "bounce-in", label: "Bounce In" },
];

const EXIT_ANIMATION_OPTIONS = [
  { value: "fade-out", label: "Fade Out" },
  { value: "zoom-out", label: "Zoom Out" },
  { value: "slide-down", label: "Slide Down" },
  { value: "flip-out", label: "Flip Out" },
  { value: "blur-out", label: "Blur Out" },
];

export const DEFAULT_OVERLAY_SETTINGS = {
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

type Settings = typeof DEFAULT_OVERLAY_SETTINGS;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: number;
  boardNumber: number;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-5 mb-3">
      {children}
    </p>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <Label className="text-xs text-muted-foreground shrink-0 w-36">{label}</Label>
      <div className="flex-1 flex justify-end">{children}</div>
    </div>
  );
}

function hexToRgb(hex: string) {
  const h = (hex || "#000000").replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `${r}, ${g}, ${b}`;
}

function cardBackground(s: Settings): string {
  const bgRgb = hexToRgb(s.bgColor || "#0f172a");
  if (s.bgType === "gradient") {
    const endRgb = hexToRgb(s.bgGradientEndColor || "#1e3a5f");
    return `linear-gradient(${s.bgGradientAngle}deg, rgba(${bgRgb}, ${s.bgOpacity}), rgba(${endRgb}, ${s.bgOpacity}))`;
  }
  return `rgba(${bgRgb}, ${s.bgOpacity})`;
}

export function PostMatchOverlaySettings({ open, onOpenChange, tournamentId, boardNumber }: Props) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings>(DEFAULT_OVERLAY_SETTINGS);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(0.3);

  const qk = [`/api/tournaments/${tournamentId}/board-overlay-settings/${boardNumber}`];

  const { data: savedSettings, isLoading } = useQuery<Record<string, any>>({
    queryKey: qk,
    enabled: open,
  });

  useEffect(() => {
    if (savedSettings) {
      const merged: any = {
        ...DEFAULT_OVERLAY_SETTINGS,
        ...savedSettings,
        showStats: { ...DEFAULT_OVERLAY_SETTINGS.showStats, ...(savedSettings.showStats ?? {}) },
      };
      // Backwards compat: migrate single sponsorLogoUrl into sponsorLogoUrls array
      if ((!merged.sponsorLogoUrls || (merged.sponsorLogoUrls as string[]).length === 0) && merged.sponsorLogoUrl) {
        merged.sponsorLogoUrls = [merged.sponsorLogoUrl];
      }
      setSettings(merged as Settings);
    }
  }, [savedSettings]);

  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setPreviewScale(Math.min(width / 1920, height / 1080));
      }
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, [open]);

  const saveMutation = useMutation({
    mutationFn: async (data: Settings) => {
      return apiRequest("PUT", `/api/tournaments/${tournamentId}/board-overlay-settings/${boardNumber}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      toast({ title: "Settings saved", description: "Post Match Card Overlay settings updated." });
    },
    onError: () => {
      toast({ title: "Save failed", variant: "destructive" });
    },
  });

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings(prev => ({ ...prev, [key]: value }));

  const setShowStat = (key: string, val: boolean) =>
    setSettings(prev => ({ ...prev, showStats: { ...prev.showStats, [key]: val } }));

  const moveStatOrder = (key: string, dir: -1 | 1) => {
    setSettings(prev => {
      const order = [...prev.statOrder];
      const idx = order.indexOf(key);
      if (idx < 0) return prev;
      const target = idx + dir;
      if (target < 0 || target >= order.length) return prev;
      [order[idx], order[target]] = [order[target], order[idx]];
      return { ...prev, statOrder: order };
    });
  };

  const addSponsorLogo = () =>
    setSettings(prev => ({ ...prev, sponsorLogoUrls: [...(prev.sponsorLogoUrls ?? []), ""] }));

  const updateSponsorLogo = (idx: number, val: string) =>
    setSettings(prev => {
      const urls = [...(prev.sponsorLogoUrls ?? [])];
      urls[idx] = val;
      return { ...prev, sponsorLogoUrls: urls };
    });

  const removeSponsorLogo = (idx: number) =>
    setSettings(prev => ({ ...prev, sponsorLogoUrls: (prev.sponsorLogoUrls ?? []).filter((_, i) => i !== idx) }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[95vw] sm:max-w-none p-0 flex flex-row gap-0 overflow-hidden"
        data-testid="sheet-post-match-settings"
      >
        {/* ── Left: settings controls ─────────────────────────── */}
        <div className="w-[380px] max-w-[45vw] min-w-[300px] shrink-0 flex flex-col h-full border-r bg-background">
          <SheetHeader className="px-5 py-4 border-b shrink-0">
            <SheetTitle className="text-sm">Post Match Card — Board {boardNumber}</SheetTitle>
          </SheetHeader>

          {isLoading ? (
            <div className="flex items-center justify-center flex-1">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-5 pb-4">

              {/* COLOURS */}
              <SectionLabel>Colours</SectionLabel>
              <Row label="Winner Star">
                <Switch checked={settings.showWinnerStar} onCheckedChange={v => set("showWinnerStar", v)}
                  data-testid="switch-winner-star" />
              </Row>
              <Row label="BG Type">
                <Select value={settings.bgType} onValueChange={v => set("bgType", v as "solid" | "gradient")}>
                  <SelectTrigger className="h-8 w-28 text-xs" data-testid="select-bg-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solid">Solid</SelectItem>
                    <SelectItem value="gradient">Gradient</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row label="BG Colour">
                <input type="color" value={settings.bgColor} onChange={e => set("bgColor", e.target.value)}
                  className="h-8 w-16 rounded border cursor-pointer" data-testid="color-bg" />
              </Row>
              {settings.bgType === "gradient" && (
                <>
                  <Row label="Gradient End">
                    <input type="color" value={settings.bgGradientEndColor} onChange={e => set("bgGradientEndColor", e.target.value)}
                      className="h-8 w-16 rounded border cursor-pointer" data-testid="color-bg-gradient-end" />
                  </Row>
                  <Row label="Gradient Angle">
                    <div className="flex items-center gap-2">
                      <input type="range" min={0} max={360} step={5} value={settings.bgGradientAngle}
                        onChange={e => set("bgGradientAngle", parseInt(e.target.value))}
                        className="w-20" data-testid="range-gradient-angle" />
                      <span className="text-xs w-8 text-right">{settings.bgGradientAngle}°</span>
                    </div>
                  </Row>
                </>
              )}
              <Row label="BG Opacity">
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <input type="range" min={0} max={1} step={0.01} value={settings.bgOpacity}
                    onChange={e => set("bgOpacity", parseFloat(e.target.value))}
                    className="w-24" data-testid="range-bg-opacity" />
                  <span className="text-xs w-8 text-right">{Math.round(settings.bgOpacity * 100)}%</span>
                </div>
              </Row>
              <Row label="Primary Colour">
                <input type="color" value={settings.primaryColor} onChange={e => set("primaryColor", e.target.value)}
                  className="h-8 w-16 rounded border cursor-pointer" data-testid="color-primary" />
              </Row>
              <Row label="Secondary Colour">
                <input type="color" value={settings.secondaryColor} onChange={e => set("secondaryColor", e.target.value)}
                  className="h-8 w-16 rounded border cursor-pointer" data-testid="color-secondary" />
              </Row>
              <Row label="Text Colour">
                <input type="color" value={settings.textColor} onChange={e => set("textColor", e.target.value)}
                  className="h-8 w-16 rounded border cursor-pointer" data-testid="color-text" />
              </Row>
              <Row label="Winner Highlight">
                <input type="color" value={settings.winnerHighlightColor} onChange={e => set("winnerHighlightColor", e.target.value)}
                  className="h-8 w-16 rounded border cursor-pointer" data-testid="color-winner" />
              </Row>

              <Separator className="my-3" />

              {/* TYPOGRAPHY */}
              <SectionLabel>Typography</SectionLabel>
              <Row label="Font Family">
                <Select value={settings.fontFamily} onValueChange={v => set("fontFamily", v)}>
                  <SelectTrigger className="h-8 w-44 text-xs" data-testid="select-font">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Title Size">
                <div className="flex items-center gap-2">
                  <input type="range" min={10} max={36} step={1} value={settings.titleFontSize}
                    onChange={e => set("titleFontSize", parseInt(e.target.value))}
                    className="w-20" data-testid="range-title-size" />
                  <span className="text-xs w-8 text-right">{settings.titleFontSize}px</span>
                </div>
              </Row>
              <Row label="Player Name Size">
                <div className="flex items-center gap-2">
                  <input type="range" min={14} max={56} step={1} value={settings.playerNameFontSize}
                    onChange={e => set("playerNameFontSize", parseInt(e.target.value))}
                    className="w-20" data-testid="range-name-size" />
                  <span className="text-xs w-8 text-right">{settings.playerNameFontSize}px</span>
                </div>
              </Row>
              <Row label="Stats Size">
                <div className="flex items-center gap-2">
                  <input type="range" min={10} max={28} step={1} value={settings.statsFontSize}
                    onChange={e => set("statsFontSize", parseInt(e.target.value))}
                    className="w-20" data-testid="range-stats-size" />
                  <span className="text-xs w-8 text-right">{settings.statsFontSize}px</span>
                </div>
              </Row>
              <Row label="Stat Spacing">
                <div className="flex items-center gap-2">
                  <input type="range" min={2} max={24} step={1} value={settings.statRowPadding}
                    onChange={e => set("statRowPadding", parseInt(e.target.value))}
                    className="w-20" data-testid="range-stat-spacing" />
                  <span className="text-xs w-8 text-right">{settings.statRowPadding}px</span>
                </div>
              </Row>

              <Separator className="my-3" />

              {/* LAYOUT */}
              <SectionLabel>Layout</SectionLabel>
              <Row label="Card Width">
                <div className="flex items-center gap-2">
                  <input type="range" min={700} max={1800} step={20} value={settings.cardWidth}
                    onChange={e => set("cardWidth", parseInt(e.target.value))}
                    className="w-20" data-testid="range-card-width" />
                  <span className="text-xs w-10 text-right">{settings.cardWidth}px</span>
                </div>
              </Row>
              <Row label="Border Radius">
                <div className="flex items-center gap-2">
                  <input type="range" min={0} max={32} step={1} value={settings.borderRadius}
                    onChange={e => set("borderRadius", parseInt(e.target.value))}
                    className="w-20" data-testid="range-border-radius" />
                  <span className="text-xs w-8 text-right">{settings.borderRadius}px</span>
                </div>
              </Row>
              <Row label="Sponsor Area">
                <Switch checked={settings.showSponsorArea} onCheckedChange={v => set("showSponsorArea", v)}
                  data-testid="switch-sponsor" />
              </Row>
              {settings.showSponsorArea && (
                <>
                  <Row label="Logo Max Height">
                    <div className="flex items-center gap-2">
                      <input type="range" min={24} max={120} step={4} value={settings.sponsorLogoMaxHeight}
                        onChange={e => set("sponsorLogoMaxHeight", parseInt(e.target.value))}
                        className="w-20" data-testid="range-sponsor-height" />
                      <span className="text-xs w-8 text-right">{settings.sponsorLogoMaxHeight}px</span>
                    </div>
                  </Row>
                  <div className="mt-2 mb-1">
                    <p className="text-xs text-muted-foreground mb-2">Sponsor Logos</p>
                    {(settings.sponsorLogoUrls ?? []).map((url, idx) => (
                      <div key={idx} className="flex items-center gap-1 mb-1">
                        <Input
                          className="h-7 text-xs flex-1"
                          placeholder="https://…"
                          value={url}
                          onChange={e => updateSponsorLogo(idx, e.target.value)}
                          data-testid={`input-sponsor-url-${idx}`}
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeSponsorLogo(idx)} data-testid={`btn-remove-sponsor-${idx}`}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" className="w-full h-7 text-xs mt-1"
                      onClick={addSponsorLogo} data-testid="btn-add-sponsor">
                      <Plus className="w-3 h-3 mr-1" />Add Logo
                    </Button>
                  </div>
                </>
              )}

              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-2">Stats — show / order</p>
                {settings.statOrder.map((key, idx) => (
                  <div key={key} className="flex items-center gap-2 py-1 border-b last:border-0">
                    <Switch
                      checked={!!(settings.showStats as Record<string, boolean>)[key]}
                      onCheckedChange={v => setShowStat(key, v)}
                      data-testid={`switch-stat-${key}`}
                    />
                    <span className="text-xs flex-1">{STAT_LABELS[key] ?? key}</span>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveStatOrder(key, -1)} disabled={idx === 0}
                        data-testid={`btn-stat-up-${key}`}>
                        <ChevronUp className="w-3 h-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveStatOrder(key, 1)} disabled={idx === settings.statOrder.length - 1}
                        data-testid={`btn-stat-down-${key}`}>
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Separator className="my-3" />

              {/* PLAYER MEDIA */}
              <SectionLabel>Player Media</SectionLabel>
              <Row label="Left Player (A) URL">
                <Input className="h-8 text-xs w-48" placeholder="Image or video URL"
                  value={settings.playerAMediaUrl} onChange={e => set("playerAMediaUrl", e.target.value)}
                  data-testid="input-media-a" />
              </Row>
              <Row label="Right Player (B) URL">
                <Input className="h-8 text-xs w-48" placeholder="Image or video URL"
                  value={settings.playerBMediaUrl} onChange={e => set("playerBMediaUrl", e.target.value)}
                  data-testid="input-media-b" />
              </Row>
              <Row label="Media Position">
                <Select value={settings.mediaPosition} onValueChange={v => set("mediaPosition", v as "top" | "side")}>
                  <SelectTrigger className="h-8 w-28 text-xs" data-testid="select-media-position">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top">Top Strip</SelectItem>
                    <SelectItem value="side">Side Panels</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Media Fit">
                <Select value={settings.mediaFit} onValueChange={v => set("mediaFit", v as "cover" | "contain")}>
                  <SelectTrigger className="h-8 w-28 text-xs" data-testid="select-media-fit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cover">Cover</SelectItem>
                    <SelectItem value="contain">Contain</SelectItem>
                  </SelectContent>
                </Select>
              </Row>

              <Separator className="my-3" />

              {/* ANIMATIONS */}
              <SectionLabel>Animations</SectionLabel>
              <Row label="Entrance">
                <Select value={settings.entranceAnimation} onValueChange={v => set("entranceAnimation", v)}>
                  <SelectTrigger className="h-8 w-44 text-xs" data-testid="select-entrance">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ANIMATION_OPTIONS.map(a => (
                      <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Exit">
                <Select value={settings.exitAnimation} onValueChange={v => set("exitAnimation", v)}>
                  <SelectTrigger className="h-8 w-44 text-xs" data-testid="select-exit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXIT_ANIMATION_OPTIONS.map(a => (
                      <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Duration (ms)">
                <div className="flex items-center gap-2">
                  <input type="range" min={200} max={2000} step={50} value={settings.animationDuration}
                    onChange={e => set("animationDuration", parseInt(e.target.value))}
                    className="w-20" data-testid="range-anim-duration" />
                  <span className="text-xs w-12 text-right">{settings.animationDuration}ms</span>
                </div>
              </Row>
              <Row label="Stat Reveal Delay">
                <div className="flex items-center gap-2">
                  <input type="range" min={50} max={500} step={10} value={settings.statRevealDelay}
                    onChange={e => set("statRevealDelay", parseInt(e.target.value))}
                    className="w-20" data-testid="range-stat-delay" />
                  <span className="text-xs w-12 text-right">{settings.statRevealDelay}ms</span>
                </div>
              </Row>
              <Row label="Hold Duration (s)">
                <div className="flex items-center gap-2">
                  <input type="range" min={3000} max={60000} step={1000} value={settings.holdDuration}
                    onChange={e => set("holdDuration", parseInt(e.target.value))}
                    className="w-20" data-testid="range-hold" />
                  <span className="text-xs w-12 text-right">{settings.holdDuration / 1000}s</span>
                </div>
              </Row>
              <Row label="Auto-hide">
                <Switch checked={settings.autoHide} onCheckedChange={v => set("autoHide", v)}
                  data-testid="switch-autohide" />
              </Row>
              <Row label="Refresh Interval (s)">
                <div className="flex items-center gap-2">
                  <input type="range" min={3000} max={60000} step={1000} value={settings.refreshInterval}
                    onChange={e => set("refreshInterval", parseInt(e.target.value))}
                    className="w-20" data-testid="range-refresh" />
                  <span className="text-xs w-12 text-right">{settings.refreshInterval / 1000}s</span>
                </div>
              </Row>

            </div>
          )}
          {/* Pinned save footer */}
          {!isLoading && (
            <div className="shrink-0 border-t bg-background px-5 py-3">
              <Button
                size="sm"
                className="w-full text-xs"
                onClick={() => saveMutation.mutate(settings)}
                disabled={saveMutation.isPending}
                data-testid="btn-save-overlay-settings"
              >
                {saveMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                Save Settings
              </Button>
            </div>
          )}
        </div>

        {/* ── Right: live preview ──────────────────────────────── */}
        <div
          ref={previewContainerRef}
          className="flex-1 min-w-0 bg-neutral-950 flex items-center justify-center overflow-hidden relative"
          data-testid="preview-container"
        >
          <div className="absolute top-2 left-3 text-white/30 text-[10px] font-mono tracking-widest uppercase select-none">
            Live Preview · 1920 × 1080
          </div>
          <div
            style={{
              width: 1920,
              height: 1080,
              transform: `scale(${previewScale})`,
              transformOrigin: "center center",
              flexShrink: 0,
            }}
          >
            <PreviewCard settings={settings} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PreviewCard({ settings: s }: { settings: Settings }) {
  const STAT_LBL: Record<string, string> = {
    average: "3-Dart Avg", ton80s: "180s", ton40s: "140+",
    tons: "100+", checkoutPct: "Checkout %", highestCheckout: "Highest Finish", bestLeg: "Best Leg",
  };
  const DEMO: Record<string, { a: string; b: string }> = {
    average: { a: "45.2", b: "38.7" },
    ton80s: { a: "2", b: "1" },
    ton40s: { a: "3", b: "2" },
    tons: { a: "5", b: "4" },
    checkoutPct: { a: "33.3%", b: "25.0%" },
    highestCheckout: { a: "161", b: "96" },
    bestLeg: { a: "15", b: "18" },
  };
  const showStats = s.showStats as Record<string, boolean>;
  const visibleStats = s.statOrder.filter(k => showStats[k]);
  const cardBg = cardBackground(s);
  const isSide = s.mediaPosition === "side";
  const hasMediaA = !!s.playerAMediaUrl;
  const hasMediaB = !!s.playerBMediaUrl;
  const hasMedia = hasMediaA || hasMediaB;
  const logoUrls = (s.sponsorLogoUrls ?? []).filter(Boolean);

  const cardContent = (
    <>
      {/* Tournament name */}
      <div style={{
        textAlign: "center",
        padding: (hasMedia && !isSide) ? "10px 40px 0" : "28px 40px 0",
        color: `rgba(${hexToRgb(s.textColor)}, 0.6)`,
        fontSize: s.titleFontSize, fontWeight: 600,
        letterSpacing: "0.12em", textTransform: "uppercase",
      }}>
        Example Tournament
      </div>

      {/* Score row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 40px 0", gap: 20 }}>
        <div style={{ flex: 1, textAlign: "right", color: s.winnerHighlightColor, fontSize: s.playerNameFontSize, fontWeight: 800, letterSpacing: "0.02em" }}>
          Player A {s.showWinnerStar && <span style={{ marginLeft: 10, fontSize: s.playerNameFontSize * 0.6, opacity: 0.85 }}>★</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.07)", borderRadius: 10, overflow: "hidden", minWidth: 160, flexShrink: 0 }}>
          <div style={{ flex: 1, textAlign: "center", padding: "10px 20px", fontSize: s.playerNameFontSize * 1.1, fontWeight: 900, color: s.winnerHighlightColor, background: `rgba(${hexToRgb(s.winnerHighlightColor)}, 0.1)` }}>2</div>
          <div style={{ width: 2, background: "rgba(255,255,255,0.12)", alignSelf: "stretch" }} />
          <div style={{ flex: 1, textAlign: "center", padding: "10px 20px", fontSize: s.playerNameFontSize * 1.1, fontWeight: 900, color: s.textColor }}>1</div>
        </div>
        <div style={{ flex: 1, textAlign: "left", color: s.textColor, fontSize: s.playerNameFontSize, fontWeight: 800, letterSpacing: "0.02em" }}>
          Player B
        </div>
      </div>

      {/* Divider */}
      <div style={{ margin: "14px 40px", height: 1, background: `linear-gradient(to right, transparent, rgba(${hexToRgb(s.primaryColor)}, 0.6), rgba(${hexToRgb(s.secondaryColor)}, 0.6), transparent)` }} />

      {/* Stats */}
      <div style={{ padding: "0 40px", paddingBottom: s.showSponsorArea ? 16 : 28 }}>
        {visibleStats.map((k, idx) => (
          <div key={k} style={{ display: "flex", alignItems: "center", padding: `${s.statRowPadding}px 0`, borderBottom: idx < visibleStats.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
            <div style={{ flex: 1, textAlign: "right", fontSize: s.statsFontSize + 2, fontWeight: 700, color: s.textColor, paddingRight: 20 }}>{DEMO[k]?.a ?? "—"}</div>
            <div style={{ width: 200, textAlign: "center", fontSize: s.statsFontSize, fontWeight: 500, color: `rgba(${hexToRgb(s.textColor)}, 0.5)`, textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0 }}>{STAT_LBL[k] ?? k}</div>
            <div style={{ flex: 1, textAlign: "left", fontSize: s.statsFontSize + 2, fontWeight: 700, color: s.textColor, paddingLeft: 20 }}>{DEMO[k]?.b ?? "—"}</div>
          </div>
        ))}
      </div>

      {/* Sponsor */}
      {s.showSponsorArea && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: "12px 40px 20px", display: "flex", justifyContent: "center", alignItems: "center", gap: 24, minHeight: 60 }}>
          {logoUrls.length > 0
            ? logoUrls.map((url, i) => (
                <img key={i} src={url} alt={`Sponsor ${i + 1}`} style={{ maxHeight: s.sponsorLogoMaxHeight, maxWidth: 280, objectFit: "contain" }} />
              ))
            : <div style={{ color: `rgba(${hexToRgb(s.textColor)}, 0.25)`, fontSize: 13, fontStyle: "italic" }}>Sponsor area</div>}
        </div>
      )}
    </>
  );

  if (isSide) {
    const sideW = 360;
    return (
      <div style={{ width: 1920, height: 1080, background: "transparent", display: "flex", alignItems: "center", fontFamily: s.fontFamily }}>
        {/* Left: Player A panel */}
        <div style={{ width: sideW, height: 1080, flexShrink: 0, position: "relative", overflow: "hidden" }}>
          {hasMediaA
            ? <img src={s.playerAMediaUrl} alt="Player A" style={{ width: "100%", height: "100%", objectFit: s.mediaFit as any, display: "block" }} />
            : <div style={{ width: "100%", height: "100%", background: `rgba(${hexToRgb(s.primaryColor)}, 0.25)` }} />}
          <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 160, background: `linear-gradient(to right, transparent, ${cardBg})` }} />
        </div>

        {/* Center: stats card */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", height: 1080 }}>
          <div style={{
            width: Math.min(s.cardWidth, 1920 - sideW * 2),
            background: cardBg,
            borderRadius: s.borderRadius,
            overflow: "hidden",
            boxShadow: "0 8px 48px rgba(0,0,0,0.7)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}>
            {cardContent}
          </div>
        </div>

        {/* Right: Player B panel */}
        <div style={{ width: sideW, height: 1080, flexShrink: 0, position: "relative", overflow: "hidden" }}>
          {hasMediaB
            ? <img src={s.playerBMediaUrl} alt="Player B" style={{ width: "100%", height: "100%", objectFit: s.mediaFit as any, display: "block" }} />
            : <div style={{ width: "100%", height: "100%", background: `rgba(${hexToRgb(s.secondaryColor)}, 0.25)` }} />}
          <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 160, background: `linear-gradient(to left, transparent, ${cardBg})` }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: 1920, height: 1080, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: s.fontFamily }}>
      <div style={{
        width: s.cardWidth,
        background: cardBg,
        borderRadius: s.borderRadius,
        overflow: "hidden",
        boxShadow: "0 8px 48px rgba(0,0,0,0.7)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}>
        {/* Top media strip */}
        {hasMedia && (
          <div style={{ display: "flex", height: 280, width: "100%" }}>
            <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "#000" }}>
              {hasMediaA
                ? <img src={s.playerAMediaUrl} alt="A" style={{ width: "100%", height: "100%", objectFit: s.mediaFit as any, display: "block" }} />
                : <div style={{ width: "100%", height: "100%", background: `rgba(${hexToRgb(s.primaryColor)}, 0.15)` }} />}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, background: `linear-gradient(transparent, ${cardBg})` }} />
            </div>
            <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "#000" }}>
              {hasMediaB
                ? <img src={s.playerBMediaUrl} alt="B" style={{ width: "100%", height: "100%", objectFit: s.mediaFit as any, display: "block" }} />
                : <div style={{ width: "100%", height: "100%", background: `rgba(${hexToRgb(s.secondaryColor)}, 0.15)` }} />}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, background: `linear-gradient(transparent, ${cardBg})` }} />
            </div>
          </div>
        )}
        {cardContent}
      </div>
    </div>
  );
}
