import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { LayoutShell } from "@/components/layout-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, Plus, Trophy, ChevronDown, ChevronUp, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface League {
  id: number;
  name: string;
  userId: number;
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

export default function LeaguesPage() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState("");
  const [expandedLeagues, setExpandedLeagues] = useState<Set<number>>(new Set());
  const [editingLeague, setEditingLeague] = useState<League | null>(null);
  const [editName, setEditName] = useState("");

  const { data: leagues = [], isLoading } = useQuery<League[]>({
    queryKey: ['/api/leagues'],
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest('POST', '/api/leagues', { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leagues'] });
      setIsCreateOpen(false);
      setNewLeagueName("");
      toast({ title: "League created" });
    },
    onError: () => toast({ title: "Error", description: "Failed to create league", variant: "destructive" }),
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const res = await apiRequest('PUT', `/api/leagues/${id}`, { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leagues'] });
      setEditingLeague(null);
      toast({ title: "League renamed" });
    },
    onError: () => toast({ title: "Error", description: "Failed to rename league", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/leagues/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leagues'] });
      toast({ title: "League deleted" });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete league", variant: "destructive" }),
  });

  const toggleLeague = (id: number) => {
    setExpandedLeagues(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

  return (
    <LayoutShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold" data-testid="text-leagues-title">Leagues</h1>
            <p className="text-muted-foreground mt-1">Track player points across multiple tournaments</p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-league">
            <Plus className="w-4 h-4 mr-2" />
            New League
          </Button>
        </div>

        {leagues.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Trophy className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-1">No leagues yet</h3>
              <p className="text-muted-foreground text-sm mb-4">Create a league to start tracking points across tournaments</p>
              <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-league-empty">
                <Plus className="w-4 h-4 mr-2" />
                Create League
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {leagues.map(league => (
              <LeagueCard
                key={league.id}
                league={league}
                expanded={expandedLeagues.has(league.id)}
                onToggle={() => toggleLeague(league.id)}
                onRename={() => { setEditingLeague(league); setEditName(league.name); }}
                onDelete={() => deleteMutation.mutate(league.id)}
              />
            ))}
          </div>
        )}

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Create League</DialogTitle>
            </DialogHeader>
            <Input
              data-testid="input-league-name"
              value={newLeagueName}
              onChange={(e) => setNewLeagueName(e.target.value)}
              placeholder="League name"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newLeagueName.trim()) {
                  createMutation.mutate(newLeagueName.trim());
                }
              }}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button
                data-testid="button-confirm-create-league"
                disabled={!newLeagueName.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate(newLeagueName.trim())}
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editingLeague} onOpenChange={(open) => { if (!open) setEditingLeague(null); }}>
          <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Rename League</DialogTitle>
            </DialogHeader>
            <Input
              data-testid="input-rename-league"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="League name"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && editName.trim() && editingLeague) {
                  renameMutation.mutate({ id: editingLeague.id, name: editName.trim() });
                }
              }}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingLeague(null)}>Cancel</Button>
              <Button
                data-testid="button-confirm-rename-league"
                disabled={!editName.trim() || renameMutation.isPending}
                onClick={() => editingLeague && renameMutation.mutate({ id: editingLeague.id, name: editName.trim() })}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </LayoutShell>
  );
}

function LeagueCard({ league, expanded, onToggle, onRename, onDelete }: {
  league: League;
  expanded: boolean;
  onToggle: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { data: standings, isLoading } = useQuery<LeagueStandings>({
    queryKey: ['/api/leagues/:id/standings', league.id],
    queryFn: async () => {
      const res = await fetch(`/api/leagues/${league.id}/standings`, { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch standings");
      return res.json();
    },
    enabled: expanded,
  });

  return (
    <Card data-testid={`card-league-${league.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer flex-1 min-w-0" onClick={onToggle}>
            <Trophy className="w-5 h-5 text-primary shrink-0" />
            <CardTitle className="text-lg truncate">{league.name}</CardTitle>
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0" data-testid={`button-league-menu-${league.id}`}>
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="gap-2 cursor-pointer" onSelect={onRename}>
                <Pencil className="w-4 h-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 cursor-pointer text-destructive" onSelect={onDelete}>
                <Trash2 className="w-4 h-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : standings ? (
            <div className="space-y-4">
              {standings.tournaments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {standings.tournaments.map(t => (
                    <Badge key={t.id} variant={t.status === 'COMPLETED' ? 'default' : 'outline'} className="text-xs" data-testid={`badge-tournament-${t.id}`}>
                      {t.name}
                      {t.status === 'IN_PROGRESS' && <span className="ml-1 w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />}
                    </Badge>
                  ))}
                </div>
              )}

              {standings.standings.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">No tournaments added to this league yet. Add tournaments from the tournament settings menu.</p>
              ) : (
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-center">#</TableHead>
                        <TableHead>Player</TableHead>
                        <TableHead className="text-center">Points</TableHead>
                        <TableHead className="text-center">Legs Won</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {standings.standings.map((row) => (
                        <TableRow key={row.position} data-testid={`row-standing-${row.position}`}>
                          <TableCell className="text-center font-bold tabular-nums">{row.position}</TableCell>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-center tabular-nums font-bold text-primary text-lg">{row.points}</TableCell>
                          <TableCell className="text-center tabular-nums">{row.legsWon}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      )}
    </Card>
  );
}
