import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { LayoutShell } from "@/components/layout-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, Trophy, Settings, Trash2, ArrowRight, Calendar, Search, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface League {
  id: number;
  name: string;
  userId: number;
  endDate: string | null;
  promotionCount: number;
  relegationCount: number;
  createdAt: string;
}

export default function LeaguesPage() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState("");
  const [search, setSearch] = useState("");

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

  const filteredLeagues = leagues.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <LayoutShell>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight" data-testid="text-leagues-title">Leagues</h1>
            <p className="text-muted-foreground mt-1">Track player points across multiple tournaments.</p>
          </div>
          <Button size="lg" className="shadow-lg shadow-primary/20" onClick={() => setIsCreateOpen(true)} data-testid="button-create-league">
            <Plus className="w-5 h-5 mr-2" />
            New League
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search leagues..."
            className="pl-10 h-12 text-lg bg-card border-border/50 shadow-sm rounded-xl"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-leagues"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-56 rounded-2xl" />
            ))}
          </div>
        ) : filteredLeagues.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-2xl border border-dashed">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold font-display">
              {leagues.length === 0 ? "No leagues yet" : "No leagues found"}
            </h3>
            <p className="text-muted-foreground mt-2 mb-6">
              {leagues.length === 0 ? "Create a league to start tracking points across tournaments." : "Try a different search term."}
            </p>
            {leagues.length === 0 && (
              <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-league-empty">
                <Plus className="w-4 h-4 mr-2" />
                Create League
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLeagues.map(league => (
              <LeagueCard key={league.id} league={league} />
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
      </div>
    </LayoutShell>
  );
}

function LeagueCard({ league }: { league: League }) {
  const { toast } = useToast();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/leagues/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leagues'] });
      toast({ title: "League deleted" });
      setDeleteOpen(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to delete league", variant: "destructive" }),
  });

  return (
    <Card className="group overflow-hidden hover:shadow-xl transition-all duration-300 border-border/50" data-testid={`card-league-${league.id}`}>
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1 min-w-0 flex-1">
            <h3 className="font-display font-bold text-xl text-foreground group-hover:text-primary transition-colors truncate">
              {league.name}
            </h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {league.createdAt ? format(new Date(league.createdAt), 'MMM d, yyyy') : 'Date unknown'}
            </div>
            {league.endDate && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                Ends: {format(new Date(league.endDate), 'MMM d, yyyy')}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              data-testid={`button-settings-league-${league.id}`}
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setSettingsOpen(true); }}
            >
              <Settings className="w-4 h-4" />
            </Button>
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  data-testid={`button-delete-league-${league.id}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete League</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{league.name}"? Tournaments in this league will not be deleted, but they will be unlinked from this league.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate(league.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="flex items-center gap-4 py-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-sm font-medium bg-muted/50 px-3 py-1.5 rounded-lg">
            <Trophy className="w-4 h-4 text-primary" />
            League
          </div>
          {league.promotionCount > 0 && (
            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 text-xs">
              <ArrowUpCircle className="w-3 h-3 mr-1" />
              Top {league.promotionCount}
            </Badge>
          )}
          {league.relegationCount > 0 && (
            <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 text-xs">
              <ArrowDownCircle className="w-3 h-3 mr-1" />
              Bottom {league.relegationCount}
            </Badge>
          )}
        </div>

        <div className="pt-2">
          <Link href={`/leagues/${league.id}`}>
            <Button className="w-full justify-between group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300" data-testid={`button-view-league-${league.id}`}>
              View Standings
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </div>

      <LeagueSettingsDialog league={league} open={settingsOpen} onOpenChange={setSettingsOpen} />
    </Card>
  );
}

function LeagueSettingsDialog({ league, open, onOpenChange }: { league: League; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(league.name);
  const [endDate, setEndDate] = useState(league.endDate || "");
  const [promotionEnabled, setPromotionEnabled] = useState((league.promotionCount || 0) > 0);
  const [promotionCount, setPromotionCount] = useState(league.promotionCount || 0);
  const [relegationEnabled, setRelegationEnabled] = useState((league.relegationCount || 0) > 0);
  const [relegationCount, setRelegationCount] = useState(league.relegationCount || 0);

  useEffect(() => {
    if (open) {
      setName(league.name);
      setEndDate(league.endDate || "");
      setPromotionEnabled((league.promotionCount || 0) > 0);
      setPromotionCount(league.promotionCount || 0);
      setRelegationEnabled((league.relegationCount || 0) > 0);
      setRelegationCount(league.relegationCount || 0);
    }
  }, [open, league]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "League name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await apiRequest('PUT', `/api/leagues/${league.id}`, {
        name: name.trim(),
        endDate: endDate || null,
        promotionCount: promotionEnabled ? Math.max(1, promotionCount) : 0,
        relegationCount: relegationEnabled ? Math.max(1, relegationCount) : 0,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/leagues'] });
      toast({ title: "League settings saved" });
      onOpenChange(false);
    } catch {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            League Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="space-y-2">
            <Label htmlFor="league-settings-name">League Name</Label>
            <Input
              id="league-settings-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-league-settings-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="league-end-date">End of League Date</Label>
            <Input
              id="league-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              data-testid="input-league-end-date"
            />
            {endDate && (
              <Button variant="ghost" size="sm" onClick={() => setEndDate("")} className="text-xs text-muted-foreground">
                Clear date
              </Button>
            )}
          </div>

          <div className="space-y-4 border rounded-xl p-4 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm flex items-center gap-1.5">
                  <ArrowUpCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  Promotion Zone
                </Label>
                <p className="text-xs text-muted-foreground">Highlight top players for promotion</p>
              </div>
              <Switch
                checked={promotionEnabled}
                onCheckedChange={(checked) => {
                  setPromotionEnabled(checked);
                  if (checked && promotionCount === 0) setPromotionCount(6);
                  if (!checked) {
                    setRelegationEnabled(false);
                    setRelegationCount(0);
                  }
                }}
                data-testid="switch-promotion-enabled"
              />
            </div>
            {promotionEnabled && (
              <div className="space-y-2 pl-6">
                <Label htmlFor="promotion-count" className="text-xs">Number of promotion places</Label>
                <Input
                  id="promotion-count"
                  type="number"
                  min={1}
                  max={50}
                  value={promotionCount}
                  onChange={(e) => setPromotionCount(Math.max(1, parseInt(e.target.value) || 1))}
                  data-testid="input-promotion-count"
                />
              </div>
            )}
          </div>

          {promotionEnabled && (
            <div className="space-y-4 border rounded-xl p-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm flex items-center gap-1.5">
                    <ArrowDownCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    Relegation Zone
                  </Label>
                  <p className="text-xs text-muted-foreground">Highlight bottom players for relegation</p>
                </div>
                <Switch
                  checked={relegationEnabled}
                  onCheckedChange={(checked) => {
                    setRelegationEnabled(checked);
                    if (checked && relegationCount === 0) setRelegationCount(2);
                  }}
                  data-testid="switch-relegation-enabled"
                />
              </div>
              {relegationEnabled && (
                <div className="space-y-2 pl-6">
                  <Label htmlFor="relegation-count" className="text-xs">Number of relegation places</Label>
                  <Input
                    id="relegation-count"
                    type="number"
                    min={1}
                    max={50}
                    value={relegationCount}
                    onChange={(e) => setRelegationCount(Math.max(1, parseInt(e.target.value) || 1))}
                    data-testid="input-relegation-count"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} data-testid="button-save-league-settings">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
