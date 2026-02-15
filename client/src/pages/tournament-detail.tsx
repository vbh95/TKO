import { useState } from "react";
import { useParams, Link } from "wouter";
import { useTournament, useTournamentShare, useBulkUpdatePlayers } from "@/hooks/use-tournaments";
import { LayoutShell } from "@/components/layout-shell";
import { MatchScoreInput } from "@/components/match-score-input";
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
  Radio
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { Match, Player, GroupMembership } from "@shared/schema";
import { cn } from "@/lib/utils";

export default function TournamentDetail() {
  const { id } = useParams();
  const tournamentId = parseInt(id || "0");
  const { data, isLoading } = useTournament(tournamentId);
  const { enableShare, disableShare } = useTournamentShare(tournamentId);
  const { mutate: bulkUpdate, isPending: isUpdatingPlayers } = useBulkUpdatePlayers(tournamentId);
  const { toast } = useToast();

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [copied, setCopied] = useState(false);
  const [bulkInput, setBulkInput] = useState("");
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);

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
      const roundKeys = Array.from(new Set(nonGroupMatches.map((m: any) => m.roundKey))) as string[];
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
  const ptsDraw = settings.pointsForDraw ?? 1;
  const ptsLoss = settings.pointsForLoss ?? 0;

  const calcStandings = (playerList: Player[], matchList: typeof matches) => {
    const stats = playerList.map((player: Player) => {
      const playerMatches = matchList.filter((m: any) => 
        (m.playerAId === player.id || m.playerBId === player.id) && m.status === 'COMPLETED'
      );
      
      let played = 0, won = 0, drawn = 0, lost = 0, legsFor = 0, legsAgainst = 0;
      
      playerMatches.forEach((m: any) => {
        played++;
        const isA = m.playerAId === player.id;
        const myScore = isA ? (m.scoreA || 0) : (m.scoreB || 0);
        const oppScore = isA ? (m.scoreB || 0) : (m.scoreA || 0);
        
        legsFor += myScore;
        legsAgainst += oppScore;
        
        if (m.winnerId === player.id) won++;
        else if (m.winnerId === null && m.status === 'COMPLETED') drawn++;
        else lost++;
      });

      return {
        ...player,
        played, won, drawn, lost, legsFor, legsAgainst,
        diff: legsFor - legsAgainst,
        pts: (won * ptsWin) + (drawn * ptsDraw) + (lost * ptsLoss)
      };
    });

    const completedMatches = matchList.filter((m: any) => m.status === 'COMPLETED');

    const headToHead = (a: any, b: any): number => {
      const h2h = completedMatches.find((m: any) =>
        (m.playerAId === a.id && m.playerBId === b.id) ||
        (m.playerAId === b.id && m.playerBId === a.id)
      );
      if (!h2h) return 0;
      if (h2h.winnerId === a.id) return -1;
      if (h2h.winnerId === b.id) return 1;
      return 0;
    };

    return stats.sort((a: any, b: any) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.legsFor !== a.legsFor) return b.legsFor - a.legsFor;
      return headToHead(a, b);
    });
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

    if (groupCount === 2) {
      pairings.push(
        { a: `1st ${groups[0].name}`, b: `2nd ${groups[1].name}` },
        { a: `1st ${groups[1].name}`, b: `2nd ${groups[0].name}` },
      );
    } else if (groupCount === 4) {
      pairings.push(
        { a: `1st ${groups[0].name}`, b: `2nd ${groups[1].name}` },
        { a: `2nd ${groups[2].name}`, b: `1st ${groups[3].name}` },
        { a: `1st ${groups[2].name}`, b: `2nd ${groups[3].name}` },
        { a: `2nd ${groups[0].name}`, b: `1st ${groups[1].name}` },
      );
    } else if (groupCount === 3) {
      pairings.push(
        { a: `1st ${groups[0].name}`, b: `2nd ${groups[2].name}` },
        { a: `1st ${groups[1].name}`, b: `2nd ${groups[0].name}` },
        { a: `1st ${groups[2].name}`, b: `2nd ${groups[1].name}` },
      );
    } else {
      for (let i = 0; i < groupCount; i++) {
        const oppIdx = (groupCount - 1 - i) % groupCount;
        pairings.push({
          a: `1st ${groups[i].name}`,
          b: `2nd ${groups[oppIdx].name}`,
        });
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
          standings: calcStandings(groupPlayers, groupMatches),
        };
      })
    : [{ group: { name: "All Players" }, standings: calcStandings(players, matches) }];

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

                      {groups.length > 0 && (
                        <div className="border-t pt-4 mt-2" data-testid="section-board-links">
                          <p className="text-sm font-medium mb-3 flex items-center gap-2">
                            <Target className="w-4 h-4 text-primary" />
                            Board-Specific Links (for scoring app)
                          </p>
                          <div className="space-y-2">
                            {[...groups].sort((a: any, b: any) => a.name.localeCompare(b.name)).map((group: any, idx: number) => {
                              const boardUrl = `${window.location.origin}/public/t/${tournament.shareToken}/board/${idx + 1}`;
                              return (
                                <div key={group.id} className="flex items-center gap-2" data-testid={`board-link-${idx + 1}`}>
                                  <span className="text-xs text-muted-foreground w-20 shrink-0">Board {idx + 1}</span>
                                  <Input readOnly value={boardUrl} className="text-xs h-8" />
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-8 w-8 shrink-0"
                                    data-testid={`button-copy-board-${idx + 1}`}
                                    onClick={() => {
                                      navigator.clipboard.writeText(boardUrl);
                                      toast({ title: `Board ${idx + 1} link copied!` });
                                    }}
                                  >
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Each board link shows only that group's matches and standings.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            
            <Button variant="outline" size="icon">
              <Settings className="w-4 h-4" />
            </Button>
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
                        {isLive ? (
                          <Badge className="bg-white/20 text-white text-xs">Live</Badge>
                        ) : isCompleted ? (
                          <Badge variant="secondary" className="text-xs">Completed</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Up Next</Badge>
                        )}
                      </div>
                      <CardContent className="p-0">
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
                          <TableHead className="text-center">D</TableHead>
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
                            <TableCell className="text-center text-muted-foreground">{player.drawn}</TableCell>
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
            <div className="space-y-4">
              <div className="flex justify-end">
                <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2" onClick={() => setBulkInput(players.map((p: Player) => p.name).join("\n"))}>
                      <Users className="w-4 h-4" />
                      Bulk Edit Players
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
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {players.map((player: Player) => (
                  <Card key={player.id}>
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {player.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold">{player.name}</h4>
                        <p className="text-xs text-muted-foreground">Seed #{player.seed || '-'}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
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
