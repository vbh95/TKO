import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { useTournament, useTournamentShare, useBulkUpdatePlayers } from "@/hooks/use-tournaments";
import { calcStandings } from "@/lib/standings";
import { LayoutShell } from "@/components/layout-shell";
import { MatchScoreInput } from "@/components/match-score-input";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Loader2, 
  Share2, 
  Settings, 
  Trophy, 
  Copy, 
  Check, 
  ExternalLink,
  Users,
  Target,
  Radio,
  TabletSmartphone,
  Wifi,
  WifiOff,
  QrCode,
  Trash2,
  ChevronDown,
  Pencil,
  Eye,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useSocket } from "@/hooks/use-socket";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Match, Player, GroupMembership, BoardSession } from "@shared/schema";
import { cn } from "@/lib/utils";

function AdminMatchStats({ matchId, playerAName, playerBName }: { matchId: number; playerAName: string; playerBName: string }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const willExpand = !expanded;
    setExpanded(willExpand);
    if (willExpand && !fetched) {
      setLoading(true);
      try {
        const res = await fetch(`/api/matches/${matchId}/notes`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setNotes(data);
        }
      } catch {}
      setLoading(false);
      setFetched(true);
    }
  };

  const threeDartAvgA = notes?.totalVisitsA > 0 ? ((notes.totalScoredA / notes.totalVisitsA) * 3).toFixed(1) : '-';
  const threeDartAvgB = notes?.totalVisitsB > 0 ? ((notes.totalScoredB / notes.totalVisitsB) * 3).toFixed(1) : '-';
  const checkoutPctA = notes?.checkoutAttemptsA > 0 ? ((notes.checkoutSuccessA / notes.checkoutAttemptsA) * 100).toFixed(1) + '%' : '-';
  const checkoutPctB = notes?.checkoutAttemptsB > 0 ? ((notes.checkoutSuccessB / notes.checkoutAttemptsB) * 100).toFixed(1) + '%' : '-';
  const statRows = notes ? [
    { label: '3-Dart Avg', valA: threeDartAvgA, valB: threeDartAvgB },
    { label: 'Checkout %', valA: checkoutPctA, valB: checkoutPctB },
    { label: 'Highest Finish', valA: notes.highestFinishA || '-', valB: notes.highestFinishB || '-' },
    { label: 'Highest Visit', valA: notes.highestVisitA || '-', valB: notes.highestVisitB || '-' },
    { label: '180s', valA: notes.ton80sA ?? '-', valB: notes.ton80sB ?? '-' },
    { label: '140+', valA: notes.ton40sA ?? '-', valB: notes.ton40sB ?? '-' },
    { label: '100+', valA: notes.tonsA ?? '-', valB: notes.tonsB ?? '-' },
    { label: 'Darts Thrown', valA: notes.totalVisitsA != null ? notes.totalVisitsA * 3 : '-', valB: notes.totalVisitsB != null ? notes.totalVisitsB * 3 : '-' },
  ] : [];

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <button
        onClick={handleToggle}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1 w-full justify-center"
        data-testid={`button-match-stats-${matchId}`}
      >
        Stats
        <ChevronDown className={cn("w-3 h-3 transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded && (
        <div className="mt-2 border-t pt-2">
          {loading && (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && notes && statRows.length > 0 && (
            <div className="grid grid-cols-3 gap-0.5 text-xs">
              <div className="text-right font-semibold text-muted-foreground truncate">{playerAName}</div>
              <div className="text-center font-semibold text-muted-foreground">Stat</div>
              <div className="text-left font-semibold text-muted-foreground truncate">{playerBName}</div>
              {statRows.map(({ label, valA, valB }) => {
                const aNum = parseFloat(String(valA));
                const bNum = parseFloat(String(valB));
                const aWins = !isNaN(aNum) && !isNaN(bNum) && aNum > bNum;
                const bWins = !isNaN(aNum) && !isNaN(bNum) && bNum > aNum;
                return (
                  <div key={label} className="contents">
                    <div className={cn("text-right tabular-nums py-0.5", aWins && "text-green-600 dark:text-green-400 font-semibold")}>{valA}</div>
                    <div className="text-center text-muted-foreground py-0.5">{label}</div>
                    <div className={cn("text-left tabular-nums py-0.5", bWins && "text-green-600 dark:text-green-400 font-semibold")}>{valB}</div>
                  </div>
                );
              })}
            </div>
          )}
          {!loading && !notes && (
            <p className="text-xs text-muted-foreground text-center py-1">No stats available</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function TournamentDetail() {
  const { id } = useParams();
  const tournamentId = parseInt(id || "0");
  const { data, isLoading } = useTournament(tournamentId);
  const { enableShare, disableShare } = useTournamentShare(tournamentId);
  const { mutate: bulkUpdate, isPending: isUpdatingPlayers } = useBulkUpdatePlayers(tournamentId);
  const { toast } = useToast();

  const { joinTournament, on, socket } = useSocket();
  const [boardStatuses, setBoardStatuses] = useState<Record<number, boolean>>({});

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [copied, setCopied] = useState(false);
  const [bulkInput, setBulkInput] = useState("");
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [isDevicesDialogOpen, setIsDevicesDialogOpen] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<number | null>(null);
  const [editingPlayerName, setEditingPlayerName] = useState("");
  const [liveScorings, setLiveScorings] = useState<Map<number, {
    matchId: number;
    remainingA: number;
    remainingB: number;
    currentThrower: 'A' | 'B';
    legsWonA: number;
    legsWonB: number;
    playerAName: string;
    playerBName: string;
    bestOf: number;
    avgA: string;
    avgB: string;
    dartsA: number;
    dartsB: number;
    lastScoreA: number | null;
    lastScoreB: number | null;
  }>>(new Map());

  useEffect(() => {
    if (tournamentId) joinTournament(tournamentId);
  }, [tournamentId, joinTournament]);

  useEffect(() => {
    const cleanup1 = on("match:updated", () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments', tournamentId] });
    });
    const cleanup2 = on("board:status", (status: { boardNumber: number; online: boolean }) => {
      setBoardStatuses(prev => ({ ...prev, [status.boardNumber]: status.online }));
    });
    const cleanup3 = on("leg:scoring", (incoming: any) => {
      setLiveScorings(prev => {
        const next = new Map(prev);
        next.set(incoming.matchId, incoming);
        return next;
      });
    });
    return () => { cleanup1(); cleanup2(); cleanup3(); };
  }, [on, tournamentId]);

  if (isLoading || !data) {
    return (
      <LayoutShell>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      </LayoutShell>
    );
  }

  const { tournament, players, matches, groups, groupMemberships = [] } = data as any;

  const handleCopyLink = () => {
    const url = `${window.location.origin}/public/t/${tournament.shareToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Link copied to clipboard" });
  };

  const handleBulkUpdate = () => {
    const names = bulkInput.split("\n").map(n => n.trim()).filter(n => n !== "");
    if (names.length < 2) {
      toast({ title: "Validation Error", description: "Need at least 2 players", variant: "destructive" });
      return;
    }

    bulkUpdate({ 
      players: names.map(name => ({ name })), 
      replace: true 
    }, {
      onSuccess: () => {
        toast({ title: "Players Updated", description: `Successfully updated ${names.length} players.` });
        setIsBulkDialogOpen(false);
      }
    });
  };

  const getPlayer = (id: number | null) => players.find((p: Player) => p.id === id) || null;

  const groupMatchData = (() => {
    const groupMatches = matches.filter((m: any) => m.stage === "GROUP");
    const nonGroupMatches = matches.filter((m: any) => m.stage !== "GROUP");

    const byGroup: { group: any; rounds: { roundKey: string; matches: any[] }[] }[] = [];

    if (groups.length > 0) {
      for (const group of groups) {
        const gMatches = groupMatches.filter((m: any) => m.groupId === group.id);
        const roundKeys = Array.from(new Set(gMatches.map((m: any) => m.roundKey))) as string[];
        roundKeys.sort((a: string, b: string) => {
          const numA = parseInt(a.replace("R", "")) || 0;
          const numB = parseInt(b.replace("R", "")) || 0;
          return numA - numB;
        });
        const rounds = roundKeys.map(rk => ({
          roundKey: rk,
          matches: gMatches.filter((m: any) => m.roundKey === rk).sort((a: any, b: any) => a.order - b.order),
        }));
        byGroup.push({ group, rounds });
      }
    }

    const nonGroupRounds: { roundKey: string; matches: any[] }[] = [];
    if (nonGroupMatches.length > 0) {
      const roundOrder: Record<string, number> = { R32: 1, R16: 2, QF: 3, SF: 4, F: 5 };
      const roundKeys = Array.from(new Set(nonGroupMatches.map((m: any) => m.roundKey))) as string[];
      roundKeys.sort((a: string, b: string) => (roundOrder[a] || 0) - (roundOrder[b] || 0));
      for (const rk of roundKeys) {
        nonGroupRounds.push({
          roundKey: rk,
          matches: nonGroupMatches.filter((m: any) => m.roundKey === rk).sort((a: any, b: any) => a.order - b.order),
        });
      }
    }

    return { byGroup, nonGroupRounds };
  })();

  const settings = (tournament.settings || {}) as any;
  const ptsWin = settings.pointsForWin ?? 2;
  const ptsLoss = settings.pointsForLoss ?? 0;

  const computeStandings = (playerList: Player[], matchList: typeof matches) => {
    return calcStandings(playerList, matchList, ptsWin, ptsLoss);
  };

  const getRoundDisplayName = (roundKey: string): string => {
    switch (roundKey) {
      case 'QF': return 'Quarter-Finals';
      case 'SF': return 'Semi-Finals';
      case 'F': return 'Final';
      case 'R16': return 'Round of 16';
      case 'R32': return 'Round of 32';
      default: return roundKey;
    }
  };

  const knockoutSlotLabels = (() => {
    const knockoutMatches = matches.filter((m: any) => m.stage === 'KNOCKOUT');
    if (knockoutMatches.length === 0 || groups.length === 0) return {};

    const sorted = [...knockoutMatches].sort((a: any, b: any) => a.order - b.order);
    const roundKeys = [] as string[];
    for (const m of sorted) {
      if (!roundKeys.includes(m.roundKey)) roundKeys.push(m.roundKey);
    }

    const labels: Record<number, { a: string; b: string }> = {};
    const matchRefs: Record<number, string> = {};

    const firstRoundKey = roundKeys[0];
    const firstRoundMatches = sorted.filter((m: any) => m.roundKey === firstRoundKey);

    const groupCount = groups.length;
    const pairings: { a: string; b: string }[] = [];

    for (let i = 0; i < groupCount; i += 2) {
      const oppIdx = i + 1;
      if (oppIdx < groupCount) {
        pairings.push(
          { a: `1st ${groups[i].name}`, b: `2nd ${groups[oppIdx].name}` },
          { a: `2nd ${groups[i].name}`, b: `1st ${groups[oppIdx].name}` },
        );
      } else {
        pairings.push(
          { a: `1st ${groups[i].name}`, b: `2nd ${groups[i].name}` },
        );
      }
    }

    firstRoundMatches.forEach((match: any, idx: number) => {
      labels[match.id] = idx < pairings.length
        ? pairings[idx]
        : { a: 'TBD', b: 'TBD' };
      matchRefs[match.id] = `${getRoundDisplayName(firstRoundKey)} ${idx + 1}`;
    });

    for (let r = 1; r < roundKeys.length; r++) {
      const prevMatches = sorted.filter((m: any) => m.roundKey === roundKeys[r - 1]);
      const currentMatches = sorted.filter((m: any) => m.roundKey === roundKeys[r]);

      currentMatches.forEach((match: any, idx: number) => {
        const prev1 = prevMatches[idx * 2];
        const prev2 = prevMatches[idx * 2 + 1];

        labels[match.id] = {
          a: prev1 ? `Winner of ${matchRefs[prev1.id]}` : 'TBD',
          b: prev2 ? `Winner of ${matchRefs[prev2.id]}` : 'TBD',
        };
        matchRefs[match.id] = roundKeys[r] === 'F'
          ? 'Final'
          : `${getRoundDisplayName(roundKeys[r])} ${idx + 1}`;
      });
    }

    return labels;
  })();

  const groupStandings = groups.length > 0
    ? groups.map((group: any) => {
        const memberPlayerIds = groupMemberships
          .filter((gm: any) => gm.groupId === group.id)
          .map((gm: any) => gm.playerId);
        const groupPlayers = players.filter((p: Player) => memberPlayerIds.includes(p.id));
        const groupMatches = matches.filter((m: any) => m.groupId === group.id);
        return {
          group,
          standings: computeStandings(groupPlayers, groupMatches),
        };
      })
    : [{ group: { name: "All Players" }, standings: computeStandings(players, matches) }];

  return (
    <LayoutShell>
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-display font-bold tracking-tight">{tournament.name}</h1>
              <Badge variant="secondary" className="text-sm font-medium">
                {tournament.type}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">Created on {new Date(tournament.createdAt!).toLocaleDateString()}</p>
          </div>
          
          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Share2 className="w-4 h-4" />
                  Share
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Share Tournament</DialogTitle>
                  <DialogDescription>
                    Anyone with the link can view live scores and standings.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  {!tournament.shareEnabled ? (
                    <div className="text-center py-6">
                      <p className="text-sm text-muted-foreground mb-4">Public sharing is currently disabled.</p>
                      <Button onClick={() => enableShare.mutate()} disabled={enableShare.isPending}>
                        Generate Public Link
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-col items-center py-2" data-testid="section-share-qr">
                        <div className="bg-white p-3 rounded-lg" id="share-qr-container">
                          <QRCodeSVG 
                            value={`${window.location.origin}/public/t/${tournament.shareToken}`} 
                            size={200} 
                            level="H"
                            includeMargin={false}
                          />
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="mt-2 text-xs"
                          data-testid="button-download-qr"
                          onClick={() => {
                            const svg = document.querySelector('#share-qr-container svg');
                            if (!svg) return;
                            const canvas = document.createElement('canvas');
                            const ctx = canvas.getContext('2d');
                            const svgData = new XMLSerializer().serializeToString(svg);
                            const img = new Image();
                            img.onload = () => {
                              canvas.width = 600;
                              canvas.height = 600;
                              ctx!.fillStyle = '#ffffff';
                              ctx!.fillRect(0, 0, 600, 600);
                              ctx!.drawImage(img, 0, 0, 600, 600);
                              const link = document.createElement('a');
                              link.download = `${tournament.name.replace(/[^a-zA-Z0-9]/g, '_')}_QR.png`;
                              link.href = canvas.toDataURL('image/png');
                              link.click();
                            };
                            img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
                          }}
                        >
                          <Download className="w-3 h-3 mr-1" /> Download QR Code
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Input 
                          readOnly 
                          value={`${window.location.origin}/public/t/${tournament.shareToken}`} 
                          data-testid="input-share-link"
                        />
                        <Button size="icon" onClick={handleCopyLink} data-testid="button-copy-share-link">
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                      <div className="flex justify-between">
                        <Button variant="ghost" asChild className="px-0">
                          <a href={`/public/t/${tournament.shareToken}`} target="_blank" rel="noopener noreferrer" data-testid="link-open-public-view">
                            Open Public View <ExternalLink className="w-3 h-3 ml-1" />
                          </a>
                        </Button>
                        <Button 
                          variant="ghost" 
                          className="text-destructive hover:text-destructive/90"
                          onClick={() => disableShare.mutate()}
                          data-testid="button-disable-sharing"
                        >
                          Disable Sharing
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" data-testid="button-settings-menu">
                  <Settings className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem data-testid="menu-item-devices" className="gap-2 cursor-pointer" onSelect={() => setIsDevicesDialogOpen(true)}>
                  <TabletSmartphone className="w-4 h-4" />
                  Connected Devices
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <BoardSessionsDialog
              open={isDevicesDialogOpen}
              onOpenChange={setIsDevicesDialogOpen}
              tournament={tournament}
              groups={groups}
              enableShare={enableShare}
              toast={toast}
              boardStatuses={boardStatuses}
            />
          </div>
        </div>

        {/* Content Tabs */}
        {(() => {
          const isMultiStage = tournament.type === "MULTI_STAGE";
          const hasKnockout = groupMatchData.nonGroupRounds.length > 0;
          const hasGroups = groupMatchData.byGroup.length > 0;
          const baseTabCount = isMultiStage ? (hasGroups && hasKnockout ? 4 : 3) : 3;
          const tabCount = baseTabCount + 1;

          const liveMatches = matches.filter((m: any) => m.status === 'IN_PROGRESS');
          const pendingMatches = matches.filter((m: any) => m.status === 'PENDING');

          const getGroupForMatch = (match: any) => {
            if (!match.groupId) return null;
            return groups.find((g: any) => g.id === match.groupId) || null;
          };

          const renderLiveTab = () => {
            const sortedGroups = [...groups].sort((a: any, b: any) => a.name.localeCompare(b.name));
            const groupStageMatches = matches.filter((m: any) => m.stage === 'GROUP');
            const knockoutStageMatches = matches.filter((m: any) => m.stage !== 'GROUP');
            const groupsFinished = groupStageMatches.length > 0 && groupStageMatches.every((m: any) => m.status === 'COMPLETED');

            const boardMatches: { group: any; match: any; isLive: boolean; label: string }[] = [];

            if (!groupsFinished) {
              for (const group of sortedGroups) {
                const inProgress = liveMatches.find((m: any) => m.groupId === group.id);
                if (inProgress) {
                  boardMatches.push({ group, match: inProgress, isLive: true, label: `${group.name} — Board ${sortedGroups.indexOf(group) + 1}` });
                } else {
                  const nextPending = pendingMatches.find((m: any) => m.groupId === group.id);
                  if (nextPending) {
                    boardMatches.push({ group, match: nextPending, isLive: false, label: `${group.name} — Board ${sortedGroups.indexOf(group) + 1}` });
                  }
                }
              }
            } else if (knockoutStageMatches.length > 0) {
              const knockoutRounds = Array.from(new Set(knockoutStageMatches.map((m: any) => m.roundKey))) as string[];
              knockoutRounds.sort((a: string, b: string) => {
                const order: Record<string, number> = { QF: 1, SF: 2, F: 3 };
                return (order[a] || 0) - (order[b] || 0);
              });

              let currentRoundKey: string | null = null;
              for (const rk of knockoutRounds) {
                const roundMatches = knockoutStageMatches.filter((m: any) => m.roundKey === rk);
                const allDone = roundMatches.every((m: any) => m.status === 'COMPLETED');
                if (!allDone) {
                  currentRoundKey = rk;
                  break;
                }
              }

              if (currentRoundKey) {
                const currentRoundMatches = knockoutStageMatches.filter((m: any) => m.roundKey === currentRoundKey);
                currentRoundMatches.forEach((match: any, i: number) => {
                  const isLive = match.status === 'IN_PROGRESS';
                  const isPending = match.status === 'PENDING';
                  const isCompleted = match.status === 'COMPLETED';
                  if (isLive || isPending || isCompleted) {
                    const slotLabel = knockoutSlotLabels[match.id];
                    const playerA = getPlayer(match.playerAId);
                    const playerB = getPlayer(match.playerBId);
                    boardMatches.push({
                      group: null,
                      match: {
                        ...match,
                        _labelA: playerA?.name || slotLabel?.a || 'TBD',
                        _labelB: playerB?.name || slotLabel?.b || 'TBD',
                      },
                      isLive,
                      label: `${getRoundDisplayName(currentRoundKey!)}${currentRoundMatches.length > 1 ? ` ${i + 1}` : ''}`
                    });
                  }
                });
              }
            }

            if (boardMatches.length === 0) {
              return (
                <div className="text-center py-12 text-muted-foreground">
                  <Radio className="w-12 h-12 mx-auto mb-4 opacity-40" />
                  <p className="text-lg font-medium">No active matches</p>
                  <p className="text-sm mt-1">All matches have been completed or none have started yet.</p>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {boardMatches.map(({ group, match, isLive, label }, idx) => {
                  const playerA = getPlayer(match.playerAId);
                  const playerB = getPlayer(match.playerBId);
                  const nameA = match._labelA || playerA?.name || "TBD";
                  const nameB = match._labelB || playerB?.name || "TBD";
                  const isCompleted = match.status === 'COMPLETED';
                  const ls = isLive ? liveScorings.get(match.id) : undefined;

                  return (
                    <Card
                      key={match.id}
                      onClick={() => setSelectedMatch(match)}
                      className={cn(
                        "overflow-hidden cursor-pointer transition-all hover:shadow-md",
                        isLive ? "border-2 border-green-500/50" : isCompleted ? "bg-muted/30" : "border-dashed"
                      )}
                      data-testid={`live-board-card-${idx + 1}`}
                    >
                      <div className={cn(
                        "px-4 py-2 flex items-center justify-between",
                        isLive ? "bg-green-600 dark:bg-green-700" : "bg-muted"
                      )}>
                        <span className={cn(
                          "font-bold text-sm flex items-center gap-2",
                          isLive ? "text-white" : "text-muted-foreground"
                        )}>
                          {isLive && <span className="w-2 h-2 bg-white rounded-full animate-pulse" />}
                          {label}
                        </span>
                        <div className="flex items-center gap-2">
                          {isLive && ls && (
                            <span className={cn("text-xs", isLive ? "text-white/70" : "text-muted-foreground")}>
                              Leg {(ls.legsWonA + ls.legsWonB + 1)} / Best of {ls.bestOf}
                            </span>
                          )}
                          {isLive ? (
                            <Badge className="bg-white/20 text-white text-xs">Live</Badge>
                          ) : isCompleted ? (
                            <Badge variant="secondary" className="text-xs">Completed</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Up Next</Badge>
                          )}
                        </div>
                      </div>
                      <CardContent className="p-0">
                        {isLive && ls ? (
                          <div className="p-3">
                            <div className="text-center mb-2">
                              <div className="flex items-center justify-center gap-3 tabular-nums">
                                <span className={cn("text-2xl font-bold", ls.legsWonA >= ls.legsWonB ? "text-primary" : "text-muted-foreground")}>{ls.legsWonA}</span>
                                <span className="text-muted-foreground text-sm">-</span>
                                <span className={cn("text-2xl font-bold", ls.legsWonB >= ls.legsWonA ? "text-primary" : "text-muted-foreground")}>{ls.legsWonB}</span>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className={cn(
                                "rounded-lg p-3 transition-all",
                                ls.currentThrower === 'A'
                                  ? "bg-red-600/15 ring-2 ring-red-500/50"
                                  : "bg-green-600/15 ring-2 ring-green-500/50"
                              )}>
                                <div className="h-3.5 mb-0.5">
                                  {ls.currentThrower === 'A' && (
                                    <div className="flex items-center gap-1">
                                      <Eye className="w-3 h-3 text-red-500" />
                                      <span className="text-[9px] font-bold uppercase tracking-wider text-red-500">Throwing</span>
                                    </div>
                                  )}
                                </div>
                                <p className="text-xs font-bold truncate">{nameA}</p>
                                <p className="text-3xl font-bold tabular-nums leading-none mt-1">{ls.remainingA}</p>
                                <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                                  <div className="flex justify-between"><span>Avg</span><span className="font-medium tabular-nums text-foreground">{ls.avgA}</span></div>
                                  <div className="flex justify-between"><span>Last</span><span className="font-medium tabular-nums text-foreground">{ls.lastScoreA !== null ? ls.lastScoreA : '-'}</span></div>
                                  <div className="flex justify-between"><span>Darts</span><span className="font-medium tabular-nums text-foreground">{ls.dartsA}</span></div>
                                </div>
                              </div>
                              <div className={cn(
                                "rounded-lg p-3 transition-all",
                                ls.currentThrower === 'B'
                                  ? "bg-red-600/15 ring-2 ring-red-500/50"
                                  : "bg-green-600/15 ring-2 ring-green-500/50"
                              )}>
                                <div className="h-3.5 mb-0.5">
                                  {ls.currentThrower === 'B' && (
                                    <div className="flex items-center gap-1">
                                      <Eye className="w-3 h-3 text-red-500" />
                                      <span className="text-[9px] font-bold uppercase tracking-wider text-red-500">Throwing</span>
                                    </div>
                                  )}
                                </div>
                                <p className="text-xs font-bold truncate">{nameB}</p>
                                <p className="text-3xl font-bold tabular-nums leading-none mt-1">{ls.remainingB}</p>
                                <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                                  <div className="flex justify-between"><span>Avg</span><span className="font-medium tabular-nums text-foreground">{ls.avgB}</span></div>
                                  <div className="flex justify-between"><span>Last</span><span className="font-medium tabular-nums text-foreground">{ls.lastScoreB !== null ? ls.lastScoreB : '-'}</span></div>
                                  <div className="flex justify-between"><span>Darts</span><span className="font-medium tabular-nums text-foreground">{ls.dartsB}</span></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between px-4 py-3 border-b">
                              <span className={cn(
                                "text-sm font-medium flex-1",
                                (isLive || isCompleted) && match.winnerId === match.playerAId && match.playerAId && "text-primary font-bold"
                              )}>
                                {nameA}
                              </span>
                              <div className={cn(
                                "w-8 h-8 flex items-center justify-center rounded text-sm font-bold",
                                (isLive || isCompleted) && (match.scoreA || 0) > (match.scoreB || 0) ? "bg-primary text-primary-foreground" : "bg-muted"
                              )}>
                                {isLive || isCompleted ? (match.scoreA || 0) : "-"}
                              </div>
                            </div>
                            <div className="flex items-center justify-between px-4 py-3">
                              <span className={cn(
                                "text-sm font-medium flex-1",
                                (isLive || isCompleted) && match.winnerId === match.playerBId && match.playerBId && "text-primary font-bold"
                              )}>
                                {nameB}
                              </span>
                              <div className={cn(
                                "w-8 h-8 flex items-center justify-center rounded text-sm font-bold",
                                (isLive || isCompleted) && (match.scoreB || 0) > (match.scoreA || 0) ? "bg-primary text-primary-foreground" : "bg-muted"
                              )}>
                                {isLive || isCompleted ? (match.scoreB || 0) : "-"}
                              </div>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            );
          };

          const renderGroupMatches = () => (
            <div className="space-y-8">
              {groupMatchData.byGroup.map(({ group, rounds }) => (
                <div key={group.id} className="space-y-4">
                  <h2 className="text-xl font-bold text-primary" data-testid={`group-header-${group.id}`}>{group.name}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {rounds.map(({ roundKey, matches: roundMatches }) => (
                      <Card key={roundKey} className="overflow-hidden" data-testid={`round-card-${group.id}-${roundKey}`}>
                        <div className="bg-primary px-4 py-2 flex items-center justify-between">
                          <span className="text-primary-foreground font-bold text-sm">
                            Round {roundKey.replace("R", "")}
                          </span>
                        </div>
                        <CardContent className="p-3 space-y-2">
                          {roundMatches.map((match: any) => {
                            const playerA = getPlayer(match.playerAId);
                            const playerB = getPlayer(match.playerBId);
                            return (
                              <div
                                key={match.id}
                                onClick={() => setSelectedMatch(match)}
                                className={cn(
                                  "rounded-lg border p-3 cursor-pointer transition-all hover:shadow-md hover:border-primary/50",
                                  match.status === 'COMPLETED' ? "bg-muted/30" : "bg-card"
                                )}
                                data-testid={`match-card-${match.id}`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 space-y-1">
                                    <div className={cn(
                                      "text-sm font-medium",
                                      match.status === 'COMPLETED' && match.winnerId === playerA?.id && "text-primary font-bold"
                                    )}>
                                      {playerA?.name || "TBD"}
                                    </div>
                                    <div className={cn(
                                      "text-sm font-medium",
                                      match.status === 'COMPLETED' && match.winnerId === playerB?.id && "text-primary font-bold"
                                    )}>
                                      {playerB?.name || "TBD"}
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-center gap-1 ml-3">
                                    <div className={cn(
                                      "w-7 h-7 flex items-center justify-center rounded text-sm font-bold",
                                      match.status === 'COMPLETED' && match.scoreA! > match.scoreB! ? "bg-primary text-primary-foreground" : "bg-muted"
                                    )}>
                                      {match.scoreA || 0}
                                    </div>
                                    <div className={cn(
                                      "w-7 h-7 flex items-center justify-center rounded text-sm font-bold",
                                      match.status === 'COMPLETED' && match.scoreB! > match.scoreA! ? "bg-primary text-primary-foreground" : "bg-muted"
                                    )}>
                                      {match.scoreB || 0}
                                    </div>
                                  </div>
                                </div>
                                {match.status === 'COMPLETED' && (
                                  <AdminMatchStats
                                    matchId={match.id}
                                    playerAName={playerA?.name || "TBD"}
                                    playerBName={playerB?.name || "TBD"}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );

          const renderKnockoutMatches = () => (
            <div className="space-y-8">
              {groupMatchData.nonGroupRounds.map(({ roundKey, matches: roundMatches }, roundIdx) => (
                <div key={roundKey} className="space-y-4">
                  <h2 className="text-xl font-bold text-primary" data-testid={`knockout-round-header-${roundKey}`}>
                    {getRoundDisplayName(roundKey)}
                  </h2>
                  <div className={cn(
                    "grid gap-4",
                    roundMatches.length === 1 ? "grid-cols-1 max-w-md mx-auto" : "grid-cols-1 md:grid-cols-2"
                  )}>
                    {roundMatches.map((match: any, matchIdx: number) => {
                      const playerA = getPlayer(match.playerAId);
                      const playerB = getPlayer(match.playerBId);
                      const slotLabel = knockoutSlotLabels[match.id];
                      const labelA = playerA?.name || slotLabel?.a || 'TBD';
                      const labelB = playerB?.name || slotLabel?.b || 'TBD';

                      return (
                        <Card
                          key={match.id}
                          onClick={() => setSelectedMatch(match)}
                          className={cn(
                            "overflow-hidden cursor-pointer transition-all hover:shadow-md hover:border-primary/50",
                            match.status === 'COMPLETED' ? "bg-muted/30" : "bg-card"
                          )}
                          data-testid={`match-card-${match.id}`}
                        >
                          <div className="bg-primary px-4 py-2 flex items-center justify-between">
                            <span className="text-primary-foreground font-bold text-sm">
                              {roundKey === 'F' ? 'Final' : `${getRoundDisplayName(roundKey)} ${matchIdx + 1}`}
                            </span>
                            {match.status === 'COMPLETED' && (
                              <Badge variant="secondary" className="text-xs">Completed</Badge>
                            )}
                          </div>
                          <CardContent className="p-0">
                            <div className="flex items-center justify-between px-4 py-3 border-b">
                              <div className="flex-1">
                                <span className={cn(
                                  "text-sm font-medium",
                                  match.status === 'COMPLETED' && match.winnerId === match.playerAId && match.playerAId && "text-primary font-bold"
                                )}>
                                  {labelA}
                                </span>
                              </div>
                              <div className={cn(
                                "w-7 h-7 flex items-center justify-center rounded text-sm font-bold",
                                match.status === 'COMPLETED' && match.scoreA > match.scoreB ? "bg-primary text-primary-foreground" : "bg-muted"
                              )}>
                                {match.scoreA || 0}
                              </div>
                            </div>
                            <div className="flex items-center justify-between px-4 py-3">
                              <div className="flex-1">
                                <span className={cn(
                                  "text-sm font-medium",
                                  match.status === 'COMPLETED' && match.winnerId === match.playerBId && match.playerBId && "text-primary font-bold"
                                )}>
                                  {labelB}
                                </span>
                              </div>
                              <div className={cn(
                                "w-7 h-7 flex items-center justify-center rounded text-sm font-bold",
                                match.status === 'COMPLETED' && match.scoreB > match.scoreA ? "bg-primary text-primary-foreground" : "bg-muted"
                              )}>
                                {match.scoreB || 0}
                              </div>
                            </div>
                            {match.status === 'COMPLETED' && (
                              <div className="px-4 pb-3">
                                <AdminMatchStats
                                  matchId={match.id}
                                  playerAName={labelA}
                                  playerBName={labelB}
                                />
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
              {groupMatchData.nonGroupRounds.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-lg font-medium">Knockout stage not yet generated</p>
                  <p className="text-sm mt-1">Complete the group stage to advance players to the knockout rounds.</p>
                </div>
              )}
            </div>
          );

          return (
            <Tabs defaultValue="live" className="space-y-6">
              <TabsList className={cn("grid w-full lg:w-[600px]", tabCount === 5 ? "grid-cols-5" : "grid-cols-4")}>
                <TabsTrigger value="live" data-testid="tab-live" className="gap-1.5">
                  <Radio className="w-3.5 h-3.5" />
                  Live
                  {liveMatches.length > 0 && (
                    <span className="ml-1 w-5 h-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center font-bold">
                      {liveMatches.length}
                    </span>
                  )}
                </TabsTrigger>
                {isMultiStage ? (
                  <>
                    <TabsTrigger value="group-stage" data-testid="tab-group-stage">Groups</TabsTrigger>
                    <TabsTrigger value="knockout" data-testid="tab-knockout">Knockout</TabsTrigger>
                  </>
                ) : (
                  <TabsTrigger value="matches" data-testid="tab-matches">Matches</TabsTrigger>
                )}
                <TabsTrigger value="standings" data-testid="tab-standings">Standings</TabsTrigger>
                <TabsTrigger value="players" data-testid="tab-players">Players</TabsTrigger>
              </TabsList>

              <TabsContent value="live" className="space-y-6" data-testid="content-live">
                {renderLiveTab()}
              </TabsContent>

              {isMultiStage ? (
                <>
                  <TabsContent value="group-stage" className="space-y-8" data-testid="content-group-stage">
                    {renderGroupMatches()}
                  </TabsContent>
                  <TabsContent value="knockout" className="space-y-6" data-testid="content-knockout">
                    {renderKnockoutMatches()}
                  </TabsContent>
                </>
              ) : (
                <TabsContent value="matches" className="space-y-8">
                  {renderGroupMatches()}
                  {renderKnockoutMatches()}
                </TabsContent>
              )}

              <TabsContent value="standings" className="space-y-6">
            {groupStandings.map(({ group, standings }: any, gIdx: number) => (
              <Card key={gIdx} data-testid={`standings-group-${gIdx}`}>
                <CardHeader>
                  <CardTitle>{group.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">#</TableHead>
                          <TableHead>Player</TableHead>
                          <TableHead className="text-center">P</TableHead>
                          <TableHead className="text-center">W</TableHead>
                          <TableHead className="text-center">L</TableHead>
                          <TableHead className="text-center hidden md:table-cell">LW</TableHead>
                          <TableHead className="text-center hidden md:table-cell">LL</TableHead>
                          <TableHead className="text-center hidden md:table-cell">+/-</TableHead>
                          <TableHead className="text-right font-bold">Pts</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {standings.map((player: any, idx: number) => {
                          const qualifying = idx < 2;
                          return (
                          <TableRow key={player.id} className={qualifying ? "bg-green-50 dark:bg-green-950/30" : ""}>
                            <TableCell className="font-medium text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                {idx + 1}
                                {qualifying && <div className="w-2 h-2 rounded-full bg-green-500" />}
                              </div>
                            </TableCell>
                            <TableCell className={cn("font-bold", qualifying && "text-green-700 dark:text-green-400")}>{player.name}</TableCell>
                            <TableCell className="text-center">{player.played}</TableCell>
                            <TableCell className="text-center text-green-600">{player.won}</TableCell>
                            <TableCell className="text-center text-red-500">{player.lost}</TableCell>
                            <TableCell className="text-center hidden md:table-cell font-mono">{player.legsFor}</TableCell>
                            <TableCell className="text-center hidden md:table-cell font-mono">{player.legsAgainst}</TableCell>
                            <TableCell className="text-center hidden md:table-cell font-mono">
                              {player.diff > 0 ? `+${player.diff}` : player.diff}
                            </TableCell>
                            <TableCell className="text-right font-bold text-primary text-lg">{player.pts}</TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
          
          <TabsContent value="players">
            {(() => {
              const getPlayerBestRound = (playerId: number) => {
                const playerMatches = matches.filter(
                  (m: any) => (m.playerAId === playerId || m.playerBId === playerId) && m.status === 'COMPLETED'
                );
                const roundPriority: Record<string, number> = { 'F': 5, 'SF': 4, 'QF': 3, 'R16': 2, 'R32': 1, 'group': 0 };
                let bestRound = 'group';
                let bestPriority = 0;
                let wonFinal = false;
                for (const m of playerMatches) {
                  const priority = roundPriority[m.roundKey] || 0;
                  if (priority > bestPriority) {
                    bestPriority = priority;
                    bestRound = m.roundKey;
                  }
                  if (m.roundKey === 'F' && m.winnerId === playerId) {
                    wonFinal = true;
                  }
                }
                return { bestRound, wonFinal };
              };

              const getPositionLabel = (bestRound: string, wonFinal: boolean) => {
                if (bestRound === 'F') return wonFinal ? 'Champion' : 'Final';
                if (bestRound === 'SF') return 'SF';
                if (bestRound === 'QF') return 'QF';
                if (bestRound === 'R16') return 'R16';
                if (bestRound === 'R32') return 'R32';
                return 'Group';
              };

              const getPositionBadgeColor = (bestRound: string, wonFinal: boolean) => {
                if (bestRound === 'F' && wonFinal) return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30';
                if (bestRound === 'F') return 'bg-gray-200/50 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300 border-gray-400/30';
                if (bestRound === 'SF') return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-400/30';
                if (bestRound === 'QF') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-400/30';
                if (bestRound === 'R16') return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-400/30';
                if (bestRound === 'R32') return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border-teal-400/30';
                return 'bg-muted text-muted-foreground border-border';
              };

              const getPoints = (bestRound: string, wonFinal: boolean) => {
                if (bestRound === 'F' && wonFinal) return 40;
                if (bestRound === 'F') return 30;
                if (bestRound === 'SF') return 20;
                if (bestRound === 'QF') return 10;
                if (bestRound === 'R16') return 8;
                if (bestRound === 'R32') return 6;
                return 5;
              };

              const getTotalLegsWon = (playerId: number) => {
                let total = 0;
                for (const m of matches) {
                  if (m.status !== 'COMPLETED') continue;
                  if (m.playerAId === playerId) total += (m.scoreA || 0);
                  if (m.playerBId === playerId) total += (m.scoreB || 0);
                }
                return total;
              };

              const playerResults = players.map((p: Player) => {
                const { bestRound, wonFinal } = getPlayerBestRound(p.id);
                return {
                  ...p,
                  bestRound,
                  wonFinal,
                  positionLabel: getPositionLabel(bestRound, wonFinal),
                  points: getPoints(bestRound, wonFinal),
                  legsWon: getTotalLegsWon(p.id),
                };
              }).sort((a: any, b: any) => b.points - a.points || b.legsWon - a.legsWon);

              const handleSavePlayerName = async (playerId: number) => {
                if (!editingPlayerName.trim()) return;
                try {
                  await apiRequest("PATCH", `/api/tournaments/${tournamentId}/players/${playerId}`, { name: editingPlayerName.trim() });
                  queryClient.invalidateQueries({ queryKey: ["/api/tournaments/:id", tournamentId] });
                  toast({ title: "Player Updated", description: "Player name has been updated." });
                  setEditingPlayerId(null);
                } catch {
                  toast({ title: "Error", description: "Failed to update player name.", variant: "destructive" });
                }
              };

              return (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Tournament Results</CardTitle>
                    <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => setBulkInput(players.map((p: Player) => p.name).join("\n"))}>
                          <Users className="w-4 h-4" />
                          Bulk Edit
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                          <DialogTitle>Bulk Edit Players</DialogTitle>
                          <DialogDescription>
                            Edit player names below. Enter one name per line.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                          <Textarea 
                            value={bulkInput} 
                            onChange={(e) => setBulkInput(e.target.value)} 
                            className="min-h-[300px] font-mono"
                            placeholder="Enter player names..."
                          />
                        </div>
                        <DialogFooter>
                          <Button variant="ghost" onClick={() => setIsBulkDialogOpen(false)}>Cancel</Button>
                          <Button onClick={handleBulkUpdate} disabled={isUpdatingPlayers}>
                            {isUpdatingPlayers && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]">#</TableHead>
                            <TableHead>Player</TableHead>
                            <TableHead className="text-center">Position</TableHead>
                            <TableHead className="text-center">Legs Won</TableHead>
                            <TableHead className="text-right font-bold">Points</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {playerResults.map((player: any, idx: number) => (
                            <TableRow key={player.id} data-testid={`player-result-row-${player.id}`}>
                              <TableCell className="font-medium text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                  {idx + 1}
                                  {player.wonFinal && <Trophy className="w-4 h-4 text-yellow-500" />}
                                </div>
                              </TableCell>
                              <TableCell>
                                {editingPlayerId === player.id ? (
                                  <div className="flex items-center gap-2">
                                    <Input
                                      value={editingPlayerName}
                                      onChange={(e) => setEditingPlayerName(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSavePlayerName(player.id);
                                        if (e.key === 'Escape') setEditingPlayerId(null);
                                      }}
                                      className="h-8 w-40"
                                      autoFocus
                                      data-testid={`input-player-name-${player.id}`}
                                    />
                                    <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => handleSavePlayerName(player.id)} data-testid={`button-save-player-${player.id}`}>
                                      <Check className="w-4 h-4 text-green-600" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setEditingPlayerId(null)}>
                                      &times;
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold">{player.name}</span>
                                    <button
                                      onClick={() => { setEditingPlayerId(player.id); setEditingPlayerName(player.name); }}
                                      className="text-muted-foreground hover:text-foreground transition-colors"
                                      data-testid={`button-edit-player-${player.id}`}
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", getPositionBadgeColor(player.bestRound, player.wonFinal))}>
                                  {player.positionLabel}
                                </span>
                              </TableCell>
                              <TableCell className="text-center font-mono">{player.legsWon}</TableCell>
                              <TableCell className="text-right font-bold text-primary text-lg">{player.points}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
              </TabsContent>
            </Tabs>
          );
        })()}

        {/* Score Dialog */}
        {selectedMatch && (
          <MatchScoreInput 
            key={selectedMatch.id}
            match={selectedMatch}
            playerA={getPlayer(selectedMatch.playerAId)}
            playerB={getPlayer(selectedMatch.playerBId)}
            isOpen={!!selectedMatch}
            onClose={() => setSelectedMatch(null)}
            tournamentId={tournamentId}
          />
        )}
      </div>
    </LayoutShell>
  );
}

function BoardSessionsDialog({ open, onOpenChange, tournament, groups, enableShare, toast, boardStatuses }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: any;
  groups: any[];
  enableShare: any;
  toast: any;
  boardStatuses: Record<number, boolean>;
}) {
  const { data: boardSessions = [], refetch: refetchSessions } = useQuery<BoardSession[]>({
    queryKey: ['/api/tournaments', tournament.id, 'board-sessions'],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${tournament.id}/board-sessions`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
  });

  const createSession = useMutation({
    mutationFn: async (boardNumber: number) => {
      const res = await apiRequest("POST", `/api/tournaments/${tournament.id}/board-sessions`, { boardNumber });
      return res.json();
    },
    onSuccess: () => {
      refetchSessions();
      toast({ title: "Scorer tablet session created" });
    },
    onError: () => {
      toast({ title: "Failed to create session", variant: "destructive" });
    },
  });

  const deleteSession = useMutation({
    mutationFn: async (sessionId: number) => {
      await apiRequest("DELETE", `/api/board-sessions/${sessionId}`);
    },
    onSuccess: () => {
      refetchSessions();
      toast({ title: "Session removed" });
    },
  });

  const sortedGroups = [...groups].sort((a: any, b: any) => a.name.localeCompare(b.name));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto" data-testid="dialog-connected-devices">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TabletSmartphone className="w-5 h-5 text-primary" />
            Connected Devices
          </DialogTitle>
          <DialogDescription>
            Create scorer tablet sessions for each board. Scan the QR code on a tablet to pair it as a scorer.
          </DialogDescription>
        </DialogHeader>

        {groups.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">No groups found. Start the tournament to generate boards.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedGroups.map((group: any, idx: number) => {
              const boardNumber = idx + 1;
              const session = boardSessions.find((s: any) => s.boardNumber === boardNumber);
              const isPaired = session?.pairedAt != null;
              const pairUrl = session ? `${window.location.origin}/pair?token=${session.pairingToken}` : null;
              const spectatorUrl = tournament.shareEnabled && tournament.shareToken
                ? `${window.location.origin}/public/t/${tournament.shareToken}/board/${boardNumber}`
                : null;

              return (
                <div key={group.id} className="border rounded-xl p-4 space-y-3" data-testid={`device-board-${boardNumber}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm">Board {boardNumber}</h3>
                      <p className="text-xs text-muted-foreground">{group.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isPaired && boardStatuses[boardNumber] && (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-300 gap-1">
                          <Wifi className="w-3 h-3" /> Online
                        </Badge>
                      )}
                      {isPaired && !boardStatuses[boardNumber] && (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 gap-1">
                          <WifiOff className="w-3 h-3" /> Paired
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        <Target className="w-3 h-3 mr-1" />
                        Board {boardNumber}
                      </Badge>
                    </div>
                  </div>

                  {session && pairUrl ? (
                    <div className="space-y-3">
                      <div className="flex justify-center bg-white rounded-lg p-4">
                        <QRCodeSVG value={pairUrl} size={160} level="M" />
                      </div>
                      <p className="text-xs text-center text-muted-foreground">
                        {isPaired ? "Tablet is paired. Scan again to re-pair a new device." : "Scan this QR code on the scorer tablet to pair it."}
                      </p>
                      <div className="flex gap-2">
                        <Input readOnly value={pairUrl} className="text-xs h-8" data-testid={`input-pair-url-${boardNumber}`} />
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 shrink-0"
                          onClick={() => {
                            navigator.clipboard.writeText(pairUrl);
                            toast({ title: `Pairing link copied!` });
                          }}
                          data-testid={`button-copy-pair-${boardNumber}`}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 shrink-0 text-destructive"
                          onClick={() => deleteSession.mutate(session.id)}
                          data-testid={`button-delete-session-${boardNumber}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>

                      {spectatorUrl && (
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground mb-1">Spectator view (read-only):</p>
                          <div className="flex gap-2">
                            <Input readOnly value={spectatorUrl} className="text-xs h-8" data-testid={`input-spectator-url-${boardNumber}`} />
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 shrink-0"
                              onClick={() => {
                                navigator.clipboard.writeText(spectatorUrl);
                                toast({ title: `Spectator link copied!` });
                              }}
                              data-testid={`button-copy-spectator-${boardNumber}`}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => createSession.mutate(boardNumber)}
                      disabled={createSession.isPending}
                      data-testid={`button-create-scorer-${boardNumber}`}
                    >
                      {createSession.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <QrCode className="w-4 h-4 mr-2" />
                      )}
                      Create Scorer Tablet for Board {boardNumber}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
