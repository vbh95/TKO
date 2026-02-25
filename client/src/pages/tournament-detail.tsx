import { useState, useRef, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { useTournament, useTournamentShare, useBulkUpdatePlayers, useDeleteTournament } from "@/hooks/use-tournaments";
import { useUser } from "@/hooks/use-auth";
import { calcStandings } from "@/lib/standings";
import { LayoutShell } from "@/components/layout-shell";
import { MatchScoreInput } from "@/components/match-score-input";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Medal } from "lucide-react";
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
  Crosshair,
  Download,
  ClipboardList,
  Plus,
  RefreshCw,
  UserPlus,
  X,
  UserCheck,
  Calendar,
  Lock,
  Unlock,
  Link as LinkIcon
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSocket } from "@/hooks/use-socket";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Match, Player, GroupMembership, BoardSession } from "@shared/schema";
import { cn } from "@/lib/utils";

function InlineScorerEdit({ matchId, tournamentId, currentName, isLegacy }: { matchId: number; tournamentId: number; currentName: string | null; isLegacy?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentName || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(currentName || '');
  }, [currentName]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const save = async () => {
    setEditing(false);
    const trimmed = value.trim();
    if (trimmed === (currentName || '')) return;
    try {
      await apiRequest('PATCH', `/api/matches/${matchId}/scorer`, { scorerName: trimmed || null });
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments/:id', tournamentId] });
    } catch {}
  };

  if (isLegacy) {
    return (
      <div className="flex items-center gap-1 truncate text-[11px] text-muted-foreground uppercase font-bold tracking-wider" data-testid={`match-scorer-${matchId}`}>
        <ClipboardList className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">Scorer: N/A</span>
      </div>
    );
  }

  return (
    <div className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider truncate" data-testid={`match-scorer-${matchId}`}>
      {editing ? (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <ClipboardList className="w-3.5 h-3.5 shrink-0" />
          <span className="shrink-0">Scorer:</span>
          <input
            ref={inputRef}
            className="bg-transparent border-b border-primary/50 outline-none text-xs text-foreground w-full max-w-[120px] px-0.5"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setValue(currentName || ''); setEditing(false); } }}
            data-testid={`input-scorer-${matchId}`}
          />
        </div>
      ) : (
        <button
          className="flex items-center gap-1 hover:text-foreground transition-colors truncate w-full"
          onClick={(e) => { e.stopPropagation(); setEditing(true); }}
          data-testid={`button-edit-scorer-${matchId}`}
        >
          <ClipboardList className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Scorer: {currentName || "None"}</span>
          <Pencil className="w-3 h-3 ml-0.5 opacity-50 shrink-0" />
        </button>
      )}
    </div>
  );
}

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
  const [, setLocation] = useLocation();
  const tournamentId = parseInt(id || "0");
  const { data, isLoading } = useTournament(tournamentId);
  const { enableShare, disableShare } = useTournamentShare(tournamentId);
  const { mutate: bulkUpdate, isPending: isUpdatingPlayers } = useBulkUpdatePlayers(tournamentId);
  const deleteTournamentMutation = useDeleteTournament();
  const { toast } = useToast();
  const { data: leaguesList = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ['/api/leagues'],
  });

  const { data: currentUser } = useUser();
  const { joinTournament, on, socket } = useSocket();
  const [boardStatuses, setBoardStatuses] = useState<Record<number, boolean>>({});
  const [newCollabEmail, setNewCollabEmail] = useState("");
  const [addingCollab, setAddingCollab] = useState(false);

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [copied, setCopied] = useState(false);
  const [bulkInput, setBulkInput] = useState("");
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [isDevicesDialogOpen, setIsDevicesDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [renameName, setRenameName] = useState("");
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("none");
  const [editingPlayerId, setEditingPlayerId] = useState<number | null>(null);
  const [editingPlayerName, setEditingPlayerName] = useState("");
  const [deletePlayerTarget, setDeletePlayerTarget] = useState<{ id: number; name: string } | null>(null);
  const [isCreateMatchOpen, setIsCreateMatchOpen] = useState(false);
  const [newMatchPlayerA, setNewMatchPlayerA] = useState<string>("");
  const [newMatchPlayerB, setNewMatchPlayerB] = useState<string>("");
  const [newMatchStage, setNewMatchStage] = useState<string>("GROUP");
  const [newMatchGroupId, setNewMatchGroupId] = useState<string>("");
  const [isCreatingMatch, setIsCreatingMatch] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isRecalcConfirmOpen, setIsRecalcConfirmOpen] = useState(false);
  const [resetMatchTarget, setResetMatchTarget] = useState<any>(null);
  const [editingKnockoutMatchId, setEditingKnockoutMatchId] = useState<number | null>(null);
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

  const { data: collaborators = [] } = useQuery<Array<{ id: number; userId: number; name: string; email: string; invitedByUserId: number | null; createdAt: string | null }>>({
    queryKey: ['/api/tournaments/:id/collaborators', tournamentId],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${tournamentId}/collaborators`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!tournamentId,
  });

  useEffect(() => {
    if (data?.tournament) {
      setRenameName(data.tournament.name);
      setSelectedLeagueId(data.tournament.leagueId?.toString() || "none");
    }
  }, [data?.tournament]);

  const addCollaboratorMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch(`/api/tournaments/${tournamentId}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to add collaborator');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments/:id/collaborators', tournamentId] });
      setNewCollabEmail("");
      toast({ title: "Collaborator added", description: "They can now manage this tournament." });
    },
    onError: (err: Error) => {
      toast({ title: "Could not add collaborator", description: err.message, variant: "destructive" });
    },
  });

  const removeCollaboratorMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await fetch(`/api/tournaments/${tournamentId}/collaborators/${userId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to remove co-admin');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments/:id/collaborators', tournamentId] });
      toast({ title: "Co-admin removed" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not remove co-admin", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (tournamentId) joinTournament(tournamentId);
  }, [tournamentId, joinTournament]);

  useEffect(() => {
    const cleanup1 = on("match:updated", () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments/:id', tournamentId] });
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
    const cleanup4 = on("tournament:updated", () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments/:id', tournamentId] });
    });
    return () => { cleanup1(); cleanup2(); cleanup3(); cleanup4(); };
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

  const { tournament, players, matches, groups, groupMemberships = [], ownerName = '', isOwner = true, isCollaborator = false } = data as any;

  const handleCopyLink = () => {
    const url = `${window.location.origin}/public/league/${tournament.shareToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Link copied to clipboard" });
  };

  const maxPlayers = players.length;

  const handleBulkUpdate = () => {
    const names = bulkInput.split("\n").map(n => n.trim()).filter(n => n !== "");
    if (names.length < 2) {
      toast({ title: "Validation Error", description: "Need at least 2 players", variant: "destructive" });
      return;
    }
    if (names.length > maxPlayers) {
      toast({ title: "Validation Error", description: `Cannot exceed ${maxPlayers} players (tournament size).`, variant: "destructive" });
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

  const handleDeletePlayer = async (playerId: number) => {
    try {
      await apiRequest("DELETE", `/api/tournaments/${tournamentId}/players/${playerId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments/:id", tournamentId] });
      toast({ title: "Player Removed", description: "Player has been removed from the tournament." });
    } catch {
      toast({ title: "Error", description: "Failed to remove player.", variant: "destructive" });
    }
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

  const handleResetMatch = async (matchId: number) => {
    try {
      await apiRequest("POST", `/api/tournaments/${tournamentId}/matches/${matchId}/reset`);
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments/:id", tournamentId] });
      setResetMatchTarget(null);
      toast({ title: "Match Reset", description: "The match result has been cleared." });
    } catch {
      toast({ title: "Error", description: "Failed to reset match.", variant: "destructive" });
    }
  };

  const handleCreateMatch = async () => {
    if (!newMatchPlayerA || !newMatchPlayerB) {
      toast({ title: "Error", description: "Both players must be selected", variant: "destructive" });
      return;
    }
    setIsCreatingMatch(true);
    try {
      await apiRequest("POST", `/api/tournaments/${tournamentId}/matches`, {
        playerAId: parseInt(newMatchPlayerA),
        playerBId: parseInt(newMatchPlayerB),
        stage: newMatchStage,
        groupId: newMatchGroupId ? parseInt(newMatchGroupId) : null,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments/:id", tournamentId] });
      toast({ title: "Match Created", description: "The manual match has been added." });
      setIsCreateMatchOpen(false);
      setNewMatchPlayerA("");
      setNewMatchPlayerB("");
    } catch {
      toast({ title: "Error", description: "Failed to create match.", variant: "destructive" });
    } finally {
      setIsCreatingMatch(false);
    }
  };

  const handleDeleteMatch = async (matchId: number) => {
    try {
      await apiRequest("DELETE", `/api/tournaments/${tournamentId}/matches/${matchId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments/:id", tournamentId] });
      toast({ title: "Match Deleted", description: "Match has been removed." });
    } catch {
      toast({ title: "Error", description: "Failed to delete match.", variant: "destructive" });
    }
  };

  const handleRecalculateMatches = async () => {
    setIsRecalculating(true);
    try {
      await apiRequest("POST", `/api/tournaments/${tournamentId}/matches/recalculate`);
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments/:id", tournamentId] });
      toast({ title: "Matches Recalculated", description: "Group matches have been regenerated based on current group assignments." });
    } catch {
      toast({ title: "Error", description: "Failed to recalculate matches.", variant: "destructive" });
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleUpdateMatchPlayer = async (matchId: number, slot: 'A' | 'B', playerId: number) => {
    try {
      const body = slot === 'A' ? { playerAId: playerId } : { playerBId: playerId };
      await apiRequest("PATCH", `/api/tournaments/${tournamentId}/matches/${matchId}/players`, body);
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments/:id", tournamentId] });
      toast({ title: "Player Updated", description: "Match player has been changed." });
    } catch {
      toast({ title: "Error", description: "Failed to update match player.", variant: "destructive" });
    }
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
                                  <div className="flex-1 space-y-2">
                                    <div className={cn(
                                      "text-base font-bold",
                                      match.status === 'COMPLETED' && match.winnerId === playerA?.id && "text-primary font-black"
                                    )}>
                                      {playerA?.name || "TBD"}
                                    </div>
                                    <div className={cn(
                                      "text-base font-bold",
                                      match.status === 'COMPLETED' && match.winnerId === playerB?.id && "text-primary font-black"
                                    )}>
                                      {playerB?.name || "TBD"}
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-center gap-2 ml-4">
                                    <div className={cn(
                                      "w-8 h-8 flex items-center justify-center rounded text-base font-black",
                                      match.status === 'COMPLETED' && match.scoreA! > match.scoreB! ? "bg-primary text-primary-foreground" : "bg-muted"
                                    )}>
                                      {match.scoreA || 0}
                                    </div>
                                    <div className={cn(
                                      "w-8 h-8 flex items-center justify-center rounded text-base font-black",
                                      match.status === 'COMPLETED' && match.scoreB! > match.scoreA! ? "bg-primary text-primary-foreground" : "bg-muted"
                                    )}>
                                      {match.scoreB || 0}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between mt-3 pt-2 border-t border-dashed">
                                  <div className="flex-1">
                                    <InlineScorerEdit
                                      matchId={match.id}
                                      tournamentId={tournamentId}
                                      currentName={match.scorerName || null}
                                      isLegacy={tournament.isLegacy || false}
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {match.status === 'COMPLETED' && !tournament.isLegacy && (
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setResetMatchTarget(match);
                                        }}
                                        data-testid={`button-reset-match-${match.id}`}
                                        title="Reset Match"
                                      >
                                        <RefreshCw className="w-4 h-4" />
                                      </Button>
                                    )}
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
              const isEditingThis = editingKnockoutMatchId === match.id && tournament.isLegacy;

              return (
                <Card
                  key={match.id}
                  onClick={() => { if (!isEditingThis) setSelectedMatch(match); }}
                  className={cn(
                    "overflow-hidden cursor-pointer transition-all hover:shadow-md hover:border-primary/50",
                    match.status === 'COMPLETED' ? "bg-muted/30" : "bg-card"
                  )}
                  data-testid={`match-card-${match.id}`}
                >
                  <div className="bg-primary px-4 py-2 flex items-center justify-between gap-2">
                    <span className="text-primary-foreground font-bold text-sm">
                      {roundKey === 'F' ? 'Final' : `${getRoundDisplayName(roundKey)} ${matchIdx + 1}`}
                    </span>
                    <div className="flex items-center gap-2">
                      {match.status === 'COMPLETED' && !tournament.isLegacy && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setResetMatchTarget(match);
                          }}
                          data-testid={`button-reset-knockout-${match.id}`}
                          title="Reset Match"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      )}
                      {match.status === 'COMPLETED' && (
                        <Badge variant="secondary" className="text-xs">Completed</Badge>
                      )}
                    </div>
                  </div>
                  <CardContent className="p-0">
                    <div className="px-4 py-2 flex justify-center border-b border-dashed">
                      <InlineScorerEdit
                        matchId={match.id}
                        tournamentId={tournamentId}
                        currentName={match.scorerName || null}
                        isLegacy={tournament.isLegacy || false}
                      />
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 border-b gap-2">
                      <div className="flex-1">
                        {isEditingThis ? (
                          <Select
                            value={match.playerAId?.toString() || ""}
                            onValueChange={(val) => handleUpdateMatchPlayer(match.id, 'A', parseInt(val))}
                          >
                            <SelectTrigger className="h-8" onClick={(e) => e.stopPropagation()} data-testid={`select-knockout-player-a-${match.id}`}>
                              <SelectValue placeholder="Select player" />
                            </SelectTrigger>
                            <SelectContent>
                              {players.map((p: Player) => (
                                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={cn(
                            "text-sm font-medium",
                            match.status === 'COMPLETED' && match.winnerId === match.playerAId && match.playerAId && "text-primary font-bold"
                          )}>
                            {labelA}
                          </span>
                        )}
                      </div>
                      <div className={cn(
                        "w-7 h-7 flex items-center justify-center rounded text-sm font-bold",
                        match.status === 'COMPLETED' && match.scoreA > match.scoreB ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}>
                        {match.scoreA || 0}
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 gap-2">
                      <div className="flex-1">
                        {isEditingThis ? (
                          <Select
                            value={match.playerBId?.toString() || ""}
                            onValueChange={(val) => handleUpdateMatchPlayer(match.id, 'B', parseInt(val))}
                          >
                            <SelectTrigger className="h-8" onClick={(e) => e.stopPropagation()} data-testid={`select-knockout-player-b-${match.id}`}>
                              <SelectValue placeholder="Select player" />
                            </SelectTrigger>
                            <SelectContent>
                              {players.map((p: Player) => (
                                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={cn(
                            "text-sm font-medium",
                            match.status === 'COMPLETED' && match.winnerId === match.playerBId && match.playerBId && "text-primary font-bold"
                          )}>
                            {labelB}
                          </span>
                        )}
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

  const isMultiStage = tournament.type === 'MULTI_STAGE';
  const liveMatches = matches.filter((m: any) => m.status === 'IN_PROGRESS');
  const tabCount = 4 + (isMultiStage ? 1 : 0);

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
              {tournament.isLegacy && (
                <Badge variant="outline" className="text-sm font-medium bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
                  Legacy
                </Badge>
              )}
            </div>
            {tournament.leagueId && (() => {
              const league = leaguesList.find((l: any) => l.id === tournament.leagueId);
              return league ? (
                <p className="flex items-center gap-1.5 mt-1 text-base font-medium text-muted-foreground" data-testid="text-tournament-league">
                  <Medal className="w-4 h-4 text-primary" />
                  {league.name}
                </p>
              ) : null;
            })()}
            {isCollaborator && (
              <div className="mt-4 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary/5 border border-primary/20 text-sm text-muted-foreground">
                <UserCheck className="w-4 h-4 text-primary shrink-0" />
                <span>You are a <span className="font-medium text-foreground">collaborator</span> on this tournament, owned by <span className="font-medium text-foreground">{ownerName}</span>.</span>
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Button
              variant="outline"
              className="w-full sm:w-auto gap-2 shadow-sm"
              onClick={() => setIsDevicesDialogOpen(true)}
              data-testid="button-tablet-scoring"
            >
              <TabletSmartphone className="w-4 h-4" />
              Tablet Scoring
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto gap-2 shadow-sm"
              onClick={() => setIsShareDialogOpen(true)}
              data-testid="button-share-public"
            >
              <Share2 className="w-4 h-4" />
              Share Public Page
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto gap-2 shadow-sm"
              onClick={() => setIsSettingsDialogOpen(true)}
              data-testid="button-tournament-settings"
            >
              <Settings className="w-4 h-4" />
              Settings & Features
            </Button>
          </div>
        </div>

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
                <TabsTrigger value="groups" data-testid="tab-groups">Groups</TabsTrigger>
                <TabsTrigger value="knockout" data-testid="tab-knockout">Knockout</TabsTrigger>
              </>
            ) : tournament.type === 'ROUND_ROBIN' ? (
              <TabsTrigger value="groups" data-testid="tab-groups">Matches</TabsTrigger>
            ) : (
              <TabsTrigger value="knockout" data-testid="tab-knockout">Matches</TabsTrigger>
            )}
            <TabsTrigger value="standings" data-testid="tab-standings">Standings</TabsTrigger>
            <TabsTrigger value="players" data-testid="tab-players">Players</TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveMatches.map((match: any) => {
                const live = liveScorings.get(match.id);
                const playerA = getPlayer(match.playerAId);
                const playerB = getPlayer(match.playerBId);
                const headerLabel = match.stage === 'GROUP'
                  ? (groups.find((g: any) => g.id === match.groupId)?.name || 'Group Match')
                  : match.roundKey === 'F' ? 'Final' : match.roundKey === 'SF' ? 'Semi Final' : match.roundKey === 'QF' ? 'Quarter Final' : 'Knockout';
                return (
                  <Card key={match.id} className="border-2 border-primary shadow-xl overflow-hidden">
                    <CardHeader className="bg-primary/10 border-b py-2.5 px-4">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                        {headerLabel}
                        {live && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            Leg {live.legsWonA + live.legsWonB + 1} / Best of {live.bestOf}
                          </span>
                        )}
                      </CardTitle>
                      <div className="flex items-center justify-between mt-2">
                        <span className="truncate max-w-[38%] text-xl font-black">{live?.playerAName || playerA?.name || 'TBD'}</span>
                        <span className="text-primary font-black font-mono shrink-0 px-3 text-2xl tabular-nums">
                          {live ? `${live.legsWonA} — ${live.legsWonB}` : `${match.scoreA || 0} — ${match.scoreB || 0}`}
                        </span>
                        <span className="truncate max-w-[38%] text-right text-xl font-black">{live?.playerBName || playerB?.name || 'TBD'}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-3 pb-4 px-4 space-y-3">
                      {live ? (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <div className={cn("rounded-lg p-3 transition-all", live.currentThrower === 'A' ? "bg-red-600/15 ring-2 ring-red-500/50" : "bg-green-600/15 ring-2 ring-green-500/50")}>
                              <div className="h-3.5 mb-0.5">
                                {live.currentThrower === 'A' && (
                                  <div className="flex items-center gap-1">
                                    <Crosshair className="w-3 h-3 text-red-500" />
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-red-500">Throwing</span>
                                  </div>
                                )}
                              </div>
                              <p className="text-xs font-bold truncate">{live.playerAName}</p>
                              <p className="text-4xl font-bold tabular-nums leading-none mt-1">{live.remainingA}</p>
                              <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                                <div className="flex justify-between"><span>Avg</span><span className="font-medium tabular-nums text-foreground">{live.avgA}</span></div>
                                <div className="flex justify-between"><span>Last</span><span className="font-medium tabular-nums text-foreground">{live.lastScoreA !== null ? live.lastScoreA : '-'}</span></div>
                                <div className="flex justify-between"><span>Darts</span><span className="font-medium tabular-nums text-foreground">{live.dartsA}</span></div>
                              </div>
                            </div>
                            <div className={cn("rounded-lg p-3 transition-all", live.currentThrower === 'B' ? "bg-red-600/15 ring-2 ring-red-500/50" : "bg-green-600/15 ring-2 ring-green-500/50")}>
                              <div className="h-3.5 mb-0.5">
                                {live.currentThrower === 'B' && (
                                  <div className="flex items-center gap-1">
                                    <Crosshair className="w-3 h-3 text-red-500" />
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-red-500">Throwing</span>
                                  </div>
                                )}
                              </div>
                              <p className="text-xs font-bold truncate">{live.playerBName}</p>
                              <p className="text-4xl font-bold tabular-nums leading-none mt-1">{live.remainingB}</p>
                              <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                                <div className="flex justify-between"><span>Avg</span><span className="font-medium tabular-nums text-foreground">{live.avgB}</span></div>
                                <div className="flex justify-between"><span>Last</span><span className="font-medium tabular-nums text-foreground">{live.lastScoreB !== null ? live.lastScoreB : '-'}</span></div>
                                <div className="flex justify-between"><span>Darts</span><span className="font-medium tabular-nums text-foreground">{live.dartsB}</span></div>
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-between text-center py-4">
                          <div className="flex-1"><p className="text-lg font-bold">{playerA?.name || "TBD"}</p></div>
                          <div className="flex items-center gap-3 px-3">
                            <span className="text-2xl font-bold tabular-nums">{match.scoreA || 0}</span>
                            <span className="text-muted-foreground text-xs uppercase font-medium">vs</span>
                            <span className="text-2xl font-bold tabular-nums">{match.scoreB || 0}</span>
                          </div>
                          <div className="flex-1"><p className="text-lg font-bold">{playerB?.name || "TBD"}</p></div>
                        </div>
                      )}
                      {match.scorerName && (
                        <p className="text-[11px] text-muted-foreground text-center" data-testid={`live-scorer-name-${match.id}`}>
                          Scorer: {match.scorerName}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {liveMatches.length === 0 && (
                <div className="col-span-full py-20 text-center bg-muted/20 border-2 border-dashed rounded-xl">
                  <div className="flex flex-col items-center gap-3">
                    <Radio className="w-10 h-10 text-muted-foreground/40 animate-pulse" />
                    <p className="text-muted-foreground font-medium">No live matches in progress</p>
                    <p className="text-xs text-muted-foreground/60 max-w-xs mx-auto">
                      Head to the Matches tab and select a match to start scoring.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="groups" className="space-y-6">
            {renderGroupMatches()}
          </TabsContent>

          <TabsContent value="knockout" className="space-y-6">
            {renderKnockoutMatches()}
          </TabsContent>

          <TabsContent value="standings" className="space-y-6">
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-2 px-1">
                <Trophy className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold tracking-tight">Group Standings</h2>
              </div>
              <div className="grid grid-cols-1 gap-8">
                {groupStandings.map(({ group, standings }) => (
                  <Card key={group.name} className="shadow-md overflow-hidden">
                    <CardHeader className="py-4 px-4 border-b">
                      <CardTitle className="text-foreground flex items-center gap-2 text-lg font-bold">
                        {group.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table className="table-fixed">
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="w-[6%] py-3 px-3 text-sm">#</TableHead>
                          <TableHead className="w-[24%] py-3 px-3 text-sm">Player</TableHead>
                          <TableHead className="w-[10%] text-center py-3 px-2 text-sm">P</TableHead>
                          <TableHead className="w-[10%] text-center py-3 px-2 text-sm">W</TableHead>
                          <TableHead className="w-[10%] text-center py-3 px-2 text-sm">L</TableHead>
                          <TableHead className="w-[10%] text-center py-3 px-2 text-sm">LW</TableHead>
                          <TableHead className="w-[10%] text-center py-3 px-2 text-sm">LL</TableHead>
                          <TableHead className="w-[10%] text-center py-3 px-2 text-sm">+/-</TableHead>
                          <TableHead className="w-[10%] text-center py-3 px-2 text-sm">Pts</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {standings.map((s: any, idx: number) => {
                          const qualifying = idx < 2;
                          return (
                          <TableRow key={s.id} className={cn(
                            qualifying ? "bg-green-50 dark:bg-green-950/30" : "",
                            "hover:bg-muted/40 transition-colors"
                          )}>
                            <TableCell className="py-4 px-3 font-medium text-muted-foreground text-sm">
                              <div className="flex items-center gap-1.5">
                                {idx + 1}
                                {qualifying && <div className="w-2 h-2 rounded-full bg-green-500" />}
                              </div>
                            </TableCell>
                            <TableCell className={cn("py-4 px-3 font-bold text-sm", qualifying && "text-green-700 dark:text-green-400")}>{s.name}</TableCell>
                            <TableCell className="py-4 px-2 text-center tabular-nums text-sm">{s.played}</TableCell>
                            <TableCell className="py-4 px-2 text-center tabular-nums text-green-600 dark:text-green-400 font-medium text-sm">{s.won}</TableCell>
                            <TableCell className="py-4 px-2 text-center tabular-nums text-destructive font-medium text-sm">{s.lost}</TableCell>
                            <TableCell className="py-4 px-2 text-center tabular-nums text-sm">{s.legsFor}</TableCell>
                            <TableCell className="py-4 px-2 text-center tabular-nums text-sm">{s.legsAgainst}</TableCell>
                            <TableCell className={cn(
                              "py-4 px-2 text-center tabular-nums font-medium text-sm",
                              s.diff > 0 ? "text-green-600" : s.diff < 0 ? "text-destructive" : ""
                            )}>
                              {s.diff > 0 ? `+${s.diff}` : s.diff}
                            </TableCell>
                            <TableCell className={cn(
                              "py-4 px-2 text-center font-bold text-base",
                              qualifying ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                            )}>{s.pts}</TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </div>
            </div>
          </TabsContent>

          <TabsContent value="players">
            {(() => {
              const getPlayerBestRound = (playerId: number) => {
                const roundPriority: Record<string, number> = { 'F': 5, 'SF': 4, 'QF': 3, 'R16': 2, 'R32': 1, 'group': 0 };
                let bestRound = 'group';
                let bestPriority = 0;
                let wonFinal = false;
                const allPlayerMatches = matches.filter(
                  (m: any) => m.playerAId === playerId || m.playerBId === playerId
                );
                for (const m of allPlayerMatches) {
                  if (m.stage === 'KNOCKOUT') {
                    const priority = roundPriority[m.roundKey] || 0;
                    if (priority > bestPriority) {
                      bestPriority = priority;
                      bestRound = m.roundKey;
                    }
                  }
                  if (m.roundKey === 'F' && m.status === 'COMPLETED' && m.winnerId === playerId) {
                    wonFinal = true;
                  }
                }
                return { bestRound, wonFinal };
              };

              const getPositionLabel = (bestRound: string, wonFinal: boolean) => {
                if (bestRound === 'F') return wonFinal ? 'Champion' : 'Runner-Up';
                if (bestRound === 'SF') return 'Semi-Finalist';
                if (bestRound === 'QF') return 'Quarter-Finalist';
                if (bestRound === 'R16') return 'R16';
                if (bestRound === 'R32') return 'R32';
                return 'Group Stage';
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

              const hasGroups = groups && groups.length > 0;
              const getPlayerGroup = (playerId: number) => {
                const membership = groupMemberships.find((m: any) => m.playerId === playerId);
                if (!membership) return null;
                return groups.find((g: any) => g.id === membership.groupId) || null;
              };

              const handleGroupReassign = async (playerId: number, newGroupId: number) => {
                try {
                  await apiRequest("PATCH", `/api/tournaments/${tournamentId}/players/${playerId}/group`, { groupId: newGroupId });
                  queryClient.invalidateQueries({ queryKey: ["/api/tournaments/:id", tournamentId] });
                  toast({ title: "Group Updated", description: "Player has been moved to a new group." });
                } catch {
                  toast({ title: "Error", description: "Failed to reassign group.", variant: "destructive" });
                }
              };

              return (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
                    <CardTitle>Tournament Results</CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      {tournament.isLegacy && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => setIsRecalcConfirmOpen(true)}
                            disabled={isRecalculating}
                            data-testid="button-recalculate-matches"
                          >
                            <RefreshCw className={cn("w-4 h-4", isRecalculating && "animate-spin")} />
                            {isRecalculating ? "Recalculating..." : "Recalculate Matches"}
                          </Button>
                          <Dialog open={isRecalcConfirmOpen} onOpenChange={setIsRecalcConfirmOpen}>
                            <DialogContent className="sm:max-w-[425px]">
                              <DialogHeader>
                                <DialogTitle>Recalculate Matches?</DialogTitle>
                                <DialogDescription>
                                  This will reset all group stage matches and regenerate them based on current group assignments. All existing group match scores will be lost. This action cannot be undone.
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <Button variant="ghost" onClick={() => setIsRecalcConfirmOpen(false)}>Cancel</Button>
                                <Button
                                  variant="destructive"
                                  onClick={() => {
                                    setIsRecalcConfirmOpen(false);
                                    handleRecalculateMatches();
                                  }}
                                  data-testid="button-confirm-recalculate"
                                >
                                  Recalculate
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </>
                      )}
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
                              {tournament.isLegacy && ` You can remove names to delete players. Maximum: ${players.length + 10} players.`}
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
                            <Button onClick={() => { bulkUpdate(bulkInput); setIsBulkDialogOpen(false); }} disabled={isUpdatingPlayers}>
                              {isUpdatingPlayers && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Save Changes
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 sm:p-6">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[40px] px-2 text-xs sm:text-sm">#</TableHead>
                            <TableHead className="px-2 text-xs sm:text-sm">Player</TableHead>
                            {hasGroups && <TableHead className="text-center px-1 text-xs sm:text-sm">Group</TableHead>}
                            <TableHead className="text-center px-1 text-xs sm:text-sm">Pos</TableHead>
                            <TableHead className="text-center px-1 text-xs sm:text-sm">LW</TableHead>
                            <TableHead className="text-right px-2 font-bold text-xs sm:text-sm">Pts</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {playerResults.map((player: any, idx: number) => {
                            const playerGroup = hasGroups ? getPlayerGroup(player.id) : null;
                            return (
                            <TableRow key={player.id} data-testid={`player-result-row-${player.id}`}>
                              <TableCell className="font-medium text-muted-foreground px-2 py-2 text-xs sm:text-sm">
                                <div className="flex items-center gap-1">
                                  {idx + 1}
                                  {player.wonFinal && <Trophy className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500" />}
                                </div>
                              </TableCell>
                              <TableCell className="px-2 py-2">
                                {editingPlayerId === player.id ? (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      value={editingPlayerName}
                                      onChange={(e) => setEditingPlayerName(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSavePlayerName(player.id);
                                        if (e.key === 'Escape') setEditingPlayerId(null);
                                      }}
                                      className="h-7 w-24 sm:h-8 sm:w-40 text-xs sm:text-sm"
                                      autoFocus
                                      data-testid={`input-player-name-${player.id}`}
                                    />
                                    <Button size="sm" variant="ghost" className="h-7 w-7 px-0" onClick={() => handleSavePlayerName(player.id)} data-testid={`button-save-player-${player.id}`}>
                                      <Check className="w-3.5 h-3.5 text-green-600" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 max-w-[80px] sm:max-w-none">
                                    <span className="font-bold truncate text-xs sm:text-sm">{player.name}</span>
                                    <button
                                      onClick={() => { setEditingPlayerId(player.id); setEditingPlayerName(player.name); }}
                                      className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                      data-testid={`button-edit-player-${player.id}`}
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </TableCell>
                              {hasGroups && (
                                <TableCell className="text-center px-1 py-2">
                                  {tournament.isLegacy ? (
                                    <Select
                                      value={playerGroup?.id?.toString() || ""}
                                      onValueChange={(val) => handleGroupReassign(player.id, parseInt(val))}
                                    >
                                      <SelectTrigger className="h-7 w-16 sm:h-8 sm:w-28 text-[10px] sm:text-xs px-1" data-testid={`select-group-${player.id}`}>
                                        <SelectValue placeholder="—" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {groups.map((g: any) => (
                                          <SelectItem key={g.id} value={g.id.toString()}>
                                            {g.name.replace("Group ", "")}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] px-1 h-5">{playerGroup?.name?.replace("Group ", "") || "—"}</Badge>
                                  )}
                                </TableCell>
                              )}
                              <TableCell className="text-center px-1 py-2">
                                <span className={cn("inline-flex items-center px-1 py-0 rounded-full text-[10px] font-medium border whitespace-nowrap", getPositionBadgeColor(player.bestRound, player.wonFinal))}>
                                  {player.positionLabel === 'Group Stage' ? 'Group' : player.positionLabel}
                                </span>
                              </TableCell>
                              <TableCell className="text-center font-mono px-1 py-2 text-xs sm:text-sm">{player.legsWon}</TableCell>
                              <TableCell className="text-right font-bold text-primary text-sm sm:text-lg px-2 py-2">{player.points}</TableCell>
                            </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {isCollaborator && (
              <div className="mt-4 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary/5 border border-primary/20 text-sm text-muted-foreground">
                <UserCheck className="w-4 h-4 text-primary shrink-0" />
                <span>You are a <span className="font-medium text-foreground">collaborator</span> on this tournament, owned by <span className="font-medium text-foreground">{ownerName}</span>.</span>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {selectedMatch && (
          <MatchScoreInput
            match={selectedMatch}
            playerA={getPlayer(selectedMatch.playerAId)}
            playerB={getPlayer(selectedMatch.playerBId)}
            isOpen={!!selectedMatch}
            onClose={() => setSelectedMatch(null)}
            tournamentId={tournamentId}
          />
        )}

        <SharePublicDialog
          open={isShareDialogOpen}
          onOpenChange={setIsShareDialogOpen}
          tournament={tournament}
          enableShare={enableShare}
          disableShare={disableShare}
          copied={copied}
          onCopyLink={handleCopyLink}
          toast={toast}
        />

        <TournamentSettingsDialog
          open={isSettingsDialogOpen}
          onOpenChange={setIsSettingsDialogOpen}
          tournament={tournament}
          isOwner={isOwner}
          isCollaborator={isCollaborator}
          ownerName={ownerName}
          leaguesList={leaguesList}
          selectedLeagueId={selectedLeagueId}
          setSelectedLeagueId={setSelectedLeagueId}
          renameName={renameName}
          setRenameName={setRenameName}
          collaborators={collaborators}
          newCollabEmail={newCollabEmail}
          setNewCollabEmail={setNewCollabEmail}
          addCollaboratorMutation={addCollaboratorMutation}
          removeCollaboratorMutation={removeCollaboratorMutation}
          deleteTournamentMutation={deleteTournamentMutation}
          tournamentId={tournamentId}
          setLocation={setLocation}
          setIsDevicesDialogOpen={setIsDevicesDialogOpen}
          enableShare={enableShare}
          disableShare={disableShare}
          toast={toast}
        />

        <BoardSessionsDialog
          open={isDevicesDialogOpen}
          onOpenChange={setIsDevicesDialogOpen}
          tournament={tournament}
          groups={groups}
          enableShare={enableShare}
          toast={toast}
          boardStatuses={boardStatuses}
        />

        <AlertDialog open={!!resetMatchTarget} onOpenChange={(open) => !open && setResetMatchTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset Match</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to reset this match? This will delete all match data, clear the result, and start the match again from scratch. This may also clear any downstream matches that depend on it.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-reset-match">Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => handleResetMatch(resetMatchTarget.id)}
                data-testid="button-confirm-reset-match"
              >
                Reset Match
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </LayoutShell>
  );
}

function SharePublicDialog({ open, onOpenChange, tournament, enableShare, disableShare, copied, onCopyLink, toast }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: any;
  enableShare: any;
  disableShare: any;
  copied: boolean;
  onCopyLink: () => void;
  toast: any;
}) {
  const shareUrl = tournament.shareToken ? `${window.location.origin}/public/t/${tournament.shareToken}` : '';

  const handleDownloadQR = () => {
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
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-4 h-4" />
            Share Tournament
          </DialogTitle>
          <DialogDescription>
            Anyone with the link can view live scores and standings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!tournament.shareEnabled ? (
            <div className="text-center py-6 space-y-3">
              <p className="text-sm text-muted-foreground">Public sharing is currently disabled.</p>
              <Button onClick={() => enableShare.mutate()} disabled={enableShare.isPending} className="gap-2">
                {enableShare.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                Generate Public Link
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col items-center" data-testid="section-share-qr">
                <div className="bg-white p-3 rounded-lg" id="share-qr-container">
                  <QRCodeSVG value={shareUrl} size={200} level="H" includeMargin={false} />
                </div>
                <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={handleDownloadQR} data-testid="button-download-qr">
                  <Download className="w-3 h-3 mr-1" /> Download QR Code
                </Button>
              </div>
              <div className="flex gap-2">
                <Input readOnly value={shareUrl} className="text-xs" data-testid="input-share-link" />
                <Button size="icon" variant="outline" onClick={onCopyLink} data-testid="button-copy-share-link">
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <div className="flex justify-between items-center">
                <Button variant="ghost" asChild className="px-0 text-sm">
                  <a href={`/public/t/${tournament.shareToken}`} target="_blank" rel="noopener noreferrer" data-testid="link-open-public-view">
                    Open Public View <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive/90"
                  onClick={() => disableShare.mutate()}
                  disabled={disableShare.isPending}
                  data-testid="button-disable-sharing"
                >
                  <Lock className="w-3 h-3 mr-1" />
                  Disable
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TournamentSettingsDialog({
  open, onOpenChange, tournament, isOwner, isCollaborator, ownerName,
  leaguesList, selectedLeagueId, setSelectedLeagueId,
  renameName, setRenameName,
  collaborators, newCollabEmail, setNewCollabEmail,
  addCollaboratorMutation, removeCollaboratorMutation, deleteTournamentMutation,
  tournamentId, setLocation, setIsDevicesDialogOpen, enableShare, disableShare, toast,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: any;
  isOwner: boolean;
  isCollaborator: boolean;
  ownerName: string;
  leaguesList: Array<{ id: number; name: string }>;
  selectedLeagueId: string;
  setSelectedLeagueId: (v: string) => void;
  renameName: string;
  setRenameName: (v: string) => void;
  collaborators: Array<{ id: number; userId: number; name: string; email: string }>;
  newCollabEmail: string;
  setNewCollabEmail: (v: string) => void;
  addCollaboratorMutation: any;
  removeCollaboratorMutation: any;
  deleteTournamentMutation: any;
  tournamentId: number;
  setLocation: (path: string) => void;
  setIsDevicesDialogOpen: (open: boolean) => void;
  enableShare: any;
  disableShare: any;
  toast: any;
}) {
  const [savingName, setSavingName] = useState(false);
  const [savingLeague, setSavingLeague] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sharecopied, setShareCopied] = useState(false);

  const handleSaveName = async () => {
    if (!renameName.trim()) return;
    setSavingName(true);
    try {
      await apiRequest('PUT', `/api/tournaments/${tournamentId}`, { name: renameName.trim() });
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments/:id', tournamentId] });
      toast({ title: "Tournament renamed" });
    } catch {
      toast({ title: "Error", description: "Failed to rename.", variant: "destructive" });
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveLeague = async () => {
    setSavingLeague(true);
    try {
      const lid = selectedLeagueId === "none" ? null : parseInt(selectedLeagueId);
      await apiRequest('PUT', `/api/tournaments/${tournamentId}/league`, { leagueId: lid });
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments/:id', tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['/api/leagues'] });
      toast({ title: lid ? "Tournament added to league" : "Tournament removed from league" });
    } catch {
      toast({ title: "Error", description: "Failed to update league.", variant: "destructive" });
    } finally {
      setSavingLeague(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); setShowDeleteConfirm(false); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Tournament Settings
          </DialogTitle>
          <DialogDescription>
            {ownerName ? <>Owner: <span className="font-medium text-foreground">{ownerName}</span></> : "Manage tournament settings and collaborators."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Rename */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Tournament Name</Label>
            <div className="flex gap-2">
              <Input
                data-testid="input-settings-rename"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                placeholder="Tournament name"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); }}
              />
              <Button size="sm" onClick={handleSaveName} disabled={savingName || !renameName.trim()} data-testid="button-settings-save-name">
                {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>

          <Separator />

          {/* League */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">League</Label>
            {leaguesList.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leagues yet. Create one from the Leagues page first.</p>
            ) : (
              <div className="flex gap-2">
                <Select value={selectedLeagueId} onValueChange={setSelectedLeagueId}>
                  <SelectTrigger data-testid="select-settings-league" className="flex-1">
                    <SelectValue placeholder="Select league" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No league</SelectItem>
                    {leaguesList.map((l: any) => (
                      <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleSaveLeague} disabled={savingLeague} data-testid="button-settings-save-league">
                  {savingLeague ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* Public Sharing */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Public Sharing</Label>
            {tournament.shareEnabled && tournament.shareToken ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Your public spectator page is live. Share the link below.</p>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/public/t/${tournament.shareToken}`}
                    className="text-xs h-8"
                    data-testid="input-settings-share-url"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/public/t/${tournament.shareToken}`);
                      setShareCopied(true);
                      setTimeout(() => setShareCopied(false), 2000);
                      toast({ title: "Link copied!" });
                    }}
                    data-testid="button-settings-copy-share"
                  >
                    {sharecopied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => disableShare.mutate()}
                    disabled={disableShare.isPending}
                    data-testid="button-settings-disable-share"
                  >
                    <Lock className="w-3 h-3 mr-1" />
                    Disable
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Allow anyone with the link to view scores and standings in real time.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => enableShare.mutate()}
                  disabled={enableShare.isPending}
                  data-testid="button-settings-enable-share"
                >
                  {enableShare.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                  Enable Public Page
                </Button>
              </div>
            )}
          </div>

          {!tournament.isLegacy && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Tablet Scoring</Label>
                <p className="text-xs text-muted-foreground">Pair scorer tablets to boards for live scoring.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  data-testid="button-settings-tablet-scoring"
                  onClick={() => { onOpenChange(false); setIsDevicesDialogOpen(true); }}
                >
                  <TabletSmartphone className="w-4 h-4" />
                  Manage Tablets
                </Button>
              </div>
            </>
          )}

          {isOwner && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Collaborators</Label>
                <p className="text-xs text-muted-foreground">Invite other TKO users to help run this tournament. They can manage players, score matches, and use tablets.</p>
                {collaborators.length > 0 && (
                  <div className="space-y-2">
                    {collaborators.map((collab) => (
                      <div key={collab.userId} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/40">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary">{collab.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" data-testid={`text-collab-name-${collab.userId}`}>{collab.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{collab.email}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => removeCollaboratorMutation.mutate(collab.userId)}
                          disabled={removeCollaboratorMutation.isPending}
                          data-testid={`button-remove-collab-${collab.userId}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter their TKO email address..."
                    value={newCollabEmail}
                    onChange={(e) => setNewCollabEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && newCollabEmail.trim()) addCollaboratorMutation.mutate(newCollabEmail.trim()); }}
                    className="h-9 text-sm"
                    data-testid="input-settings-collab-email"
                  />
                  <Button
                    size="sm"
                    className="h-9 shrink-0"
                    onClick={() => { if (newCollabEmail.trim()) addCollaboratorMutation.mutate(newCollabEmail.trim()); }}
                    disabled={!newCollabEmail.trim() || addCollaboratorMutation.isPending}
                    data-testid="button-settings-add-collab"
                  >
                    {addCollaboratorMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserPlus className="w-4 h-4 mr-1" />Add</>}
                  </Button>
                </div>
              </div>

              <Separator />
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-destructive">Danger Zone</Label>
                {!showDeleteConfirm ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive/30 text-destructive hover:bg-destructive/10 gap-2"
                    data-testid="button-settings-delete"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Tournament
                  </Button>
                ) : (
                  <div className="space-y-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                    <p className="text-sm text-destructive font-medium">Are you sure? This permanently deletes "{tournament.name}" and all its data.</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={deleteTournamentMutation.isPending}
                        data-testid="button-settings-confirm-delete"
                        onClick={() => {
                          deleteTournamentMutation.mutate(tournamentId, {
                            onSuccess: () => {
                              toast({ title: "Tournament deleted", description: `"${tournament.name}" has been removed.` });
                              setLocation("/tournaments");
                            },
                            onError: () => toast({ title: "Error", description: "Failed to delete tournament.", variant: "destructive" }),
                          });
                        }}
                      >
                        {deleteTournamentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Yes, Delete Tournament
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
            Tablet Scoring
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
