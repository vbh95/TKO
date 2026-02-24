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
  Download,
  ClipboardList,
  Plus,
  RefreshCw,
  UserPlus,
  X,
  UserCheck
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
      <div className="mt-2 pt-2 border-t border-dashed text-[10px] text-muted-foreground uppercase font-bold tracking-wider" data-testid={`match-scorer-${matchId}`}>
        <div className="flex items-center gap-1">
          <ClipboardList className="w-3 h-3" />
          Scorer: N/A
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 pt-2 border-t border-dashed text-[10px] text-muted-foreground uppercase font-bold tracking-wider" data-testid={`match-scorer-${matchId}`}>
      {editing ? (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <ClipboardList className="w-3 h-3 shrink-0" />
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
          className="flex items-center gap-1 hover:text-foreground transition-colors"
          onClick={(e) => { e.stopPropagation(); setEditing(true); }}
          data-testid={`button-edit-scorer-${matchId}`}
        >
          <ClipboardList className="w-3 h-3" />
          Scorer: {currentName || "None"}
          <Pencil className="w-2.5 h-2.5 ml-0.5 opacity-50" />
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
    const url = `${window.location.origin}/public/t/${tournament.shareToken}`;
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
                                <div className="flex items-center justify-between gap-2">
                                  <InlineScorerEdit
                                    matchId={match.id}
                                    tournamentId={tournament.id}
                                    currentName={match.scorerName || null}
                                    isLegacy={tournament.isLegacy || false}
                                  />
                                  <div className="flex items-center gap-1 mt-2 pt-2 border-t border-dashed w-full justify-end">
                                    {match.status === 'COMPLETED' && !tournament.isLegacy && (
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setResetMatchTarget(match);
                                        }}
                                        data-testid={`button-reset-match-${match.id}`}
                                        title="Reset Match"
                                      >
                                        <RefreshCw className="w-3.5 h-3.5" />
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
                    <div className="px-4 pb-2">
                      <InlineScorerEdit
                        matchId={match.id}
                        tournamentId={tournament.id}
                        currentName={match.scorerName || null}
                        isLegacy={tournament.isLegacy || false}
                      />
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {liveMatches.map((match: any) => {
                const live = liveScorings.get(match.id);
                const playerA = getPlayer(match.playerAId);
                const playerB = getPlayer(match.playerBId);
                return (
                  <Card key={match.id} className="overflow-hidden border-2 border-primary/20 bg-primary/5">
                    <CardHeader className="p-4 bg-primary text-primary-foreground flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                        </span>
                        {match.stage === 'GROUP' ? 'Group Match' : 'Knockout'}
                      </CardTitle>
                      {live && <Badge variant="secondary" className="text-[10px] h-5">BO{live.bestOf}</Badge>}
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      <div className="flex flex-col gap-3">
                        <div className={cn(
                          "flex items-center justify-between p-2.5 rounded-lg border transition-all",
                          live?.currentThrower === 'A' ? "bg-primary/10 border-primary/40 shadow-sm" : "bg-muted/30 border-transparent"
                        )}>
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center font-bold",
                              live?.currentThrower === 'A' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            )}>
                              {live?.legsWonA || 0}
                            </div>
                            <span className="font-bold truncate max-w-[120px]">{playerA?.name || "Player A"}</span>
                          </div>
                          <span className="text-2xl font-display font-black tracking-tighter tabular-nums">
                            {live?.remainingA ?? 501}
                          </span>
                        </div>
                        <div className={cn(
                          "flex items-center justify-between p-2.5 rounded-lg border transition-all",
                          live?.currentThrower === 'B' ? "bg-primary/10 border-primary/40 shadow-sm" : "bg-muted/30 border-transparent"
                        )}>
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center font-bold",
                              live?.currentThrower === 'B' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            )}>
                              {live?.legsWonB || 0}
                            </div>
                            <span className="font-bold truncate max-w-[120px]">{playerB?.name || "Player B"}</span>
                          </div>
                          <span className="text-2xl font-display font-black tracking-tighter tabular-nums">
                            {live?.remainingB ?? 501}
                          </span>
                        </div>
                      </div>
                      <Button className="w-full h-11 font-bold shadow-lg" onClick={() => setSelectedMatch(match)}>
                        <Target className="w-4 h-4 mr-2" />
                        Scorer Panel
                      </Button>
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {groupStandings.map(({ group, standings }) => (
                  <Card key={group.name} className="shadow-md overflow-hidden">
                    <CardHeader className="bg-primary py-4">
                      <CardTitle className="text-primary-foreground flex items-center gap-2 text-lg">
                        {group.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                      <TableHeader className="bg-muted/50">
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
                        {standings.map((s: any, idx: number) => {
                          const qualifying = idx < 2;
                          return (
                          <TableRow key={s.id} className={cn(
                            qualifying ? "bg-green-50 dark:bg-green-950/30" : "",
                            "hover:bg-muted/40 transition-colors"
                          )}>
                            <TableCell className="font-medium text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                {idx + 1}
                                {qualifying && <div className="w-2 h-2 rounded-full bg-green-500" />}
                              </div>
                            </TableCell>
                            <TableCell className={cn("font-bold", qualifying && "text-green-700 dark:text-green-400")}>{s.name}</TableCell>
                            <TableCell className="text-center tabular-nums">{s.played}</TableCell>
                            <TableCell className="text-center tabular-nums text-green-600 dark:text-green-400 font-medium">{s.won}</TableCell>
                            <TableCell className="text-center tabular-nums text-destructive font-medium">{s.lost}</TableCell>
                            <TableCell className="text-center tabular-nums hidden md:table-cell font-mono">{s.legsFor}</TableCell>
                            <TableCell className="text-center tabular-nums hidden md:table-cell font-mono">{s.legsAgainst}</TableCell>
                            <TableCell className={cn(
                              "text-center tabular-nums font-medium hidden md:table-cell font-mono",
                              s.diff > 0 ? "text-green-600" : s.diff < 0 ? "text-destructive" : ""
                            )}>
                              {s.diff > 0 ? `+${s.diff}` : s.diff}
                            </TableCell>
                            <TableCell className="text-right font-bold text-primary text-lg">{s.pts}</TableCell>
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
                  <CardContent>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]">#</TableHead>
                            <TableHead>Player</TableHead>
                            {hasGroups && <TableHead className="text-center">Group</TableHead>}
                            <TableHead className="text-center">Position</TableHead>
                            <TableHead className="text-center">Legs Won</TableHead>
                            <TableHead className="text-right font-bold">Points</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {playerResults.map((player: any, idx: number) => {
                            const playerGroup = hasGroups ? getPlayerGroup(player.id) : null;
                            return (
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
                                    {tournament.isLegacy && (
                                      <button
                                        onClick={() => setDeletePlayerTarget({ id: player.id, name: player.name })}
                                        className="text-muted-foreground hover:text-destructive transition-colors"
                                        data-testid={`button-delete-player-${player.id}`}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                              {hasGroups && (
                                <TableCell className="text-center">
                                  {tournament.isLegacy ? (
                                    <Select
                                      value={playerGroup?.id?.toString() || ""}
                                      onValueChange={(val) => handleGroupReassign(player.id, parseInt(val))}
                                    >
                                      <SelectTrigger className="h-8 w-28" data-testid={`select-group-${player.id}`}>
                                        <SelectValue placeholder="No group" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {groups.map((g: any) => (
                                          <SelectItem key={g.id} value={g.id.toString()}>
                                            {g.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Badge variant="outline">{playerGroup?.name || "—"}</Badge>
                                  )}
                                </TableCell>
                              )}
                              <TableCell className="text-center">
                                <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", getPositionBadgeColor(player.bestRound, player.wonFinal))}>
                                  {player.positionLabel}
                                </span>
                              </TableCell>
                              <TableCell className="text-center font-mono">{player.legsWon}</TableCell>
                              <TableCell className="text-right font-bold text-primary text-lg">{player.points}</TableCell>
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
