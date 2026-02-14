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
  Users
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
    return playerList.map((player: Player) => {
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
    }).sort((a: any, b: any) => b.pts - a.pts || b.diff - a.diff);
  };

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
                        />
                        <Button size="icon" onClick={handleCopyLink}>
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                      <div className="flex justify-between">
                        <Button variant="ghost" asChild className="px-0">
                          <a href={`/public/t/${tournament.shareToken}`} target="_blank" rel="noopener noreferrer">
                            Open Public View <ExternalLink className="w-3 h-3 ml-1" />
                          </a>
                        </Button>
                        <Button 
                          variant="ghost" 
                          className="text-destructive hover:text-destructive/90"
                          onClick={() => disableShare.mutate()}
                        >
                          Disable Sharing
                        </Button>
                      </div>
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
          const tabCount = isMultiStage ? (hasGroups && hasKnockout ? 4 : 3) : 3;

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
            <div className="space-y-6">
              {groupMatchData.nonGroupRounds.map(({ roundKey, matches: roundMatches }) => (
                <Card key={roundKey}>
                  <CardHeader>
                    <CardTitle className="text-lg font-bold">{roundKey}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    {roundMatches.map((match: any) => {
                      const playerA = getPlayer(match.playerAId);
                      const playerB = getPlayer(match.playerBId);
                      return (
                        <div
                          key={match.id}
                          onClick={() => setSelectedMatch(match)}
                          className={cn(
                            "flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md hover:border-primary/50",
                            match.status === 'COMPLETED' ? "bg-muted/30" : "bg-card"
                          )}
                          data-testid={`match-card-${match.id}`}
                        >
                          <div className="flex-1 text-right font-medium">
                            {playerA?.name || "TBD"}
                          </div>
                          <div className="flex items-center gap-3 px-6">
                            <div className={cn(
                              "w-8 h-8 flex items-center justify-center rounded-md font-bold text-lg",
                              match.scoreA! > match.scoreB! ? "bg-primary text-primary-foreground" : "bg-muted"
                            )}>
                              {match.scoreA || 0}
                            </div>
                            <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">vs</span>
                            <div className={cn(
                              "w-8 h-8 flex items-center justify-center rounded-md font-bold text-lg",
                              match.scoreB! > match.scoreA! ? "bg-primary text-primary-foreground" : "bg-muted"
                            )}>
                              {match.scoreB || 0}
                            </div>
                          </div>
                          <div className="flex-1 text-left font-medium">
                            {playerB?.name || "TBD"}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
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
            <Tabs defaultValue={isMultiStage ? "group-stage" : "matches"} className="space-y-6">
              <TabsList className={cn("grid w-full lg:w-[500px]", tabCount === 4 ? "grid-cols-4" : "grid-cols-3")}>
                {isMultiStage ? (
                  <>
                    <TabsTrigger value="group-stage" data-testid="tab-group-stage">Group Stage</TabsTrigger>
                    <TabsTrigger value="knockout" data-testid="tab-knockout">Knockout</TabsTrigger>
                  </>
                ) : (
                  <TabsTrigger value="matches" data-testid="tab-matches">Matches</TabsTrigger>
                )}
                <TabsTrigger value="standings" data-testid="tab-standings">Standings</TabsTrigger>
                <TabsTrigger value="players" data-testid="tab-players">Players</TabsTrigger>
              </TabsList>

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
                          <TableHead className="text-center hidden md:table-cell">Legs +/-</TableHead>
                          <TableHead className="text-right font-bold">Pts</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {standings.map((player: any, idx: number) => (
                          <TableRow key={player.id}>
                            <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-bold">{player.name}</TableCell>
                            <TableCell className="text-center">{player.played}</TableCell>
                            <TableCell className="text-center text-green-600">{player.won}</TableCell>
                            <TableCell className="text-center text-muted-foreground">{player.drawn}</TableCell>
                            <TableCell className="text-center text-red-500">{player.lost}</TableCell>
                            <TableCell className="text-center hidden md:table-cell font-mono">
                              {player.diff > 0 ? `+${player.diff}` : player.diff}
                            </TableCell>
                            <TableCell className="text-right font-bold text-primary text-lg">{player.pts}</TableCell>
                          </TableRow>
                        ))}
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
            match={selectedMatch}
            playerA={getPlayer(selectedMatch.playerAId)}
            playerB={getPlayer(selectedMatch.playerBId)}
            isOpen={!!selectedMatch}
            onClose={() => setSelectedMatch(null)}
          />
        )}
      </div>
    </LayoutShell>
  );
}
