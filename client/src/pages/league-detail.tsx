import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { format } from "date-fns";
import { LayoutShell } from "@/components/layout-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, ArrowLeft, Trophy, Calendar, ArrowUpCircle, ArrowDownCircle, Plus, Trash2, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface League {
  id: number;
  name: string;
  userId: number;
  startDate: string | null;
  endDate: string | null;
  promotionCount: number;
  relegationCount: number;
  createdAt: string;
}

interface StandingRow {
  position: number;
  name: string;
  points: number;
  legsWon: number;
  legsLost: number;
  legDifference: number;
  tournaments: number;
}

interface LeagueStandings {
  league: League;
  tournaments: Array<{ id: number; name: string; status: string }>;
  standings: StandingRow[];
}

interface ManualResult {
  id: number;
  leagueId: number;
  playerName: string;
  tournamentLabel: string;
  points: number;
  legsWon: number;
  legsLost: number;
  createdAt: string;
}

export default function LeagueDetail() {
  const [, params] = useRoute("/leagues/:id");
  const leagueId = params?.id ? parseInt(params.id) : 0;
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    playerName: "",
    tournamentLabel: "",
    points: "",
    legsWon: "",
    legsLost: "",
  });

  const { data, isLoading, error } = useQuery<LeagueStandings>({
    queryKey: ['/api/leagues/:id/standings', leagueId],
    queryFn: async () => {
      const res = await fetch(`/api/leagues/${leagueId}/standings`, { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch standings");
      return res.json();
    },
    enabled: leagueId > 0,
  });

  const { data: manualResults = [] } = useQuery<ManualResult[]>({
    queryKey: ['/api/leagues/:id/manual-results', leagueId],
    queryFn: async () => {
      const res = await fetch(`/api/leagues/${leagueId}/manual-results`, { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch manual results");
      return res.json();
    },
    enabled: leagueId > 0,
  });

  const addResultMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", `/api/leagues/${leagueId}/manual-results`, {
        playerName: data.playerName,
        tournamentLabel: data.tournamentLabel,
        points: parseInt(data.points) || 0,
        legsWon: parseInt(data.legsWon) || 0,
        legsLost: parseInt(data.legsLost) || 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leagues/:id/manual-results', leagueId] });
      queryClient.invalidateQueries({ queryKey: ['/api/leagues/:id/standings', leagueId] });
      setFormData({ playerName: "", tournamentLabel: "", points: "", legsWon: "", legsLost: "" });
      setAddDialogOpen(false);
      toast({ title: "Result added", description: "Past result has been added to the league." });
    },
    onError: () => toast({ title: "Error", description: "Failed to add result", variant: "destructive" }),
  });

  const deleteResultMutation = useMutation({
    mutationFn: async (resultId: number) => {
      return apiRequest("DELETE", `/api/leagues/${leagueId}/manual-results/${resultId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leagues/:id/manual-results', leagueId] });
      queryClient.invalidateQueries({ queryKey: ['/api/leagues/:id/standings', leagueId] });
      toast({ title: "Result removed", description: "Past result has been removed from the league." });
    },
    onError: () => toast({ title: "Error", description: "Failed to remove result", variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.playerName.trim() || !formData.tournamentLabel.trim()) {
      toast({ title: "Missing fields", description: "Player name and tournament name are required.", variant: "destructive" });
      return;
    }
    addResultMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <LayoutShell>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </LayoutShell>
    );
  }

  if (error || !data) {
    return (
      <LayoutShell>
        <div className="text-center py-20">
          <p className="text-muted-foreground">League not found.</p>
          <Link href="/leagues">
            <Button variant="outline" className="mt-4">Back to Leagues</Button>
          </Link>
        </div>
      </LayoutShell>
    );
  }

  const { league, tournaments, standings } = data;
  const promoCount = league.promotionCount || 0;
  const relegCount = league.relegationCount || 0;
  const totalPlayers = standings.length;

  const getRowZone = (position: number): 'promotion' | 'relegation' | null => {
    if (promoCount > 0 && position <= promoCount) return 'promotion';
    if (relegCount > 0 && totalPlayers > 0 && position > totalPlayers - relegCount) return 'relegation';
    return null;
  };

  const groupedResults: Record<string, ManualResult[]> = {};
  manualResults.forEach(r => {
    if (!groupedResults[r.tournamentLabel]) groupedResults[r.tournamentLabel] = [];
    groupedResults[r.tournamentLabel].push(r);
  });

  return (
    <LayoutShell>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/leagues">
            <Button variant="ghost" size="icon" data-testid="button-back-to-leagues">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight truncate" data-testid="text-league-detail-title">
              {league.name}
            </h1>
            <div className="flex items-center gap-4 mt-1 flex-wrap">
              {(league.startDate || league.endDate) ? (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {league.startDate && league.endDate
                    ? `${format(new Date(league.startDate), 'MMM d, yyyy')} — ${format(new Date(league.endDate), 'MMM d, yyyy')}`
                    : league.startDate
                      ? `From ${format(new Date(league.startDate), 'MMM d, yyyy')}`
                      : `Ends ${format(new Date(league.endDate!), 'MMM d, yyyy')}`
                  }
                </span>
              ) : (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Created {league.createdAt ? format(new Date(league.createdAt), 'MMM d, yyyy') : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {tournaments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tournaments.map(t => (
              <Link key={t.id} href={`/tournaments/${t.id}`}>
                <Badge
                  variant={t.status === 'COMPLETED' ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  data-testid={`badge-tournament-${t.id}`}
                >
                  {t.name}
                  {t.status === 'IN_PROGRESS' && <span className="ml-1 w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />}
                </Badge>
              </Link>
            ))}
          </div>
        )}

        {(promoCount > 0 || relegCount > 0) && (
          <div className="flex items-center gap-4 flex-wrap">
            {promoCount > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <span className="w-3 h-3 rounded-sm bg-green-500/20 border border-green-500/40" />
                <span className="text-muted-foreground">Promotion (Top {promoCount})</span>
              </div>
            )}
            {relegCount > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <span className="w-3 h-3 rounded-sm bg-red-500/20 border border-red-500/40" />
                <span className="text-muted-foreground">Relegation (Bottom {relegCount})</span>
              </div>
            )}
          </div>
        )}

        {standings.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Trophy className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-1">No standings yet</h3>
              <p className="text-muted-foreground text-sm">Add tournaments to this league or add past results to see standings.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14 text-center">Pos</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead className="text-center">Points</TableHead>
                      <TableHead className="text-center">Legs Won</TableHead>
                      <TableHead className="text-center">Leg Diff</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {standings.map((row) => {
                      const zone = getRowZone(row.position);
                      return (
                        <TableRow
                          key={row.position}
                          className={cn(
                            zone === 'promotion' && "bg-green-500/10 dark:bg-green-500/10",
                            zone === 'relegation' && "bg-red-500/10 dark:bg-red-500/10",
                          )}
                          data-testid={`row-standing-${row.position}`}
                        >
                          <TableCell className="text-center font-bold tabular-nums">
                            <div className="flex items-center justify-center gap-1">
                              {zone === 'promotion' && <ArrowUpCircle className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />}
                              {zone === 'relegation' && <ArrowDownCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />}
                              {row.position}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-center tabular-nums font-bold text-primary text-lg">{row.points}</TableCell>
                          <TableCell className="text-center tabular-nums">{row.legsWon}</TableCell>
                          <TableCell className="text-center tabular-nums">
                            <span className={cn(
                              row.legDifference > 0 && "text-green-600 dark:text-green-400",
                              row.legDifference < 0 && "text-red-600 dark:text-red-400",
                            )}>
                              {row.legDifference > 0 ? '+' : ''}{row.legDifference}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="w-4 h-4" />
                Past Tournament Results
              </CardTitle>
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-past-result">
                    <Plus className="w-4 h-4 mr-1" />
                    Add Result
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Past Tournament Result</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="tournamentLabel">Tournament Name</Label>
                      <Input
                        id="tournamentLabel"
                        placeholder="e.g. Week 1 - Jan 2025"
                        value={formData.tournamentLabel}
                        onChange={e => setFormData(d => ({ ...d, tournamentLabel: e.target.value }))}
                        data-testid="input-tournament-label"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="playerName">Player Name</Label>
                      <Input
                        id="playerName"
                        placeholder="e.g. John Smith"
                        value={formData.playerName}
                        onChange={e => setFormData(d => ({ ...d, playerName: e.target.value }))}
                        data-testid="input-player-name"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="points">Points</Label>
                        <Input
                          id="points"
                          type="number"
                          min="0"
                          placeholder="0"
                          value={formData.points}
                          onChange={e => setFormData(d => ({ ...d, points: e.target.value }))}
                          data-testid="input-points"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="legsWon">Legs Won</Label>
                        <Input
                          id="legsWon"
                          type="number"
                          min="0"
                          placeholder="0"
                          value={formData.legsWon}
                          onChange={e => setFormData(d => ({ ...d, legsWon: e.target.value }))}
                          data-testid="input-legs-won"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="legsLost">Legs Lost</Label>
                        <Input
                          id="legsLost"
                          type="number"
                          min="0"
                          placeholder="0"
                          value={formData.legsLost}
                          onChange={e => setFormData(d => ({ ...d, legsLost: e.target.value }))}
                          data-testid="input-legs-lost"
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={addResultMutation.isPending} data-testid="button-submit-past-result">
                      {addResultMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Add Result
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {manualResults.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No past results added yet. Add results from previous tournaments to include them in the league standings.
              </p>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedResults).map(([label, results]) => (
                  <div key={label} className="space-y-2">
                    <h4 className="text-sm font-semibold text-muted-foreground">{label}</h4>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Player</TableHead>
                            <TableHead className="text-center w-20">Points</TableHead>
                            <TableHead className="text-center w-24">Legs Won</TableHead>
                            <TableHead className="text-center w-24">Legs Lost</TableHead>
                            <TableHead className="w-12" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {results.map(r => (
                            <TableRow key={r.id} data-testid={`row-manual-result-${r.id}`}>
                              <TableCell className="font-medium">{r.playerName}</TableCell>
                              <TableCell className="text-center tabular-nums">{r.points}</TableCell>
                              <TableCell className="text-center tabular-nums">{r.legsWon}</TableCell>
                              <TableCell className="text-center tabular-nums">{r.legsLost}</TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteResultMutation.mutate(r.id)}
                                  disabled={deleteResultMutation.isPending}
                                  data-testid={`button-delete-result-${r.id}`}
                                >
                                  <Trash2 className="w-4 h-4 text-muted-foreground" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Scoring Criteria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              League positions are determined by the following criteria, applied in order:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 pl-1">
              <li><span className="font-medium text-foreground">Points</span> — Players are ranked by total points earned across all league tournaments. The player with the most points is ranked highest.</li>
              <li><span className="font-medium text-foreground">Legs Won</span> — If two or more players are tied on points, the player with the most legs won is ranked higher.</li>
              <li><span className="font-medium text-foreground">Leg Difference</span> — If still tied, the player with the better leg difference (legs won minus legs lost) is ranked higher.</li>
              <li><span className="font-medium text-foreground">Tournaments Attended</span> — If still tied, the player who has attended more tournaments is ranked higher.</li>
            </ol>
            <p className="text-xs text-muted-foreground/70 pt-1">
              If players remain tied after all criteria, they share the same effective position.
            </p>
          </CardContent>
        </Card>
      </div>
    </LayoutShell>
  );
}
