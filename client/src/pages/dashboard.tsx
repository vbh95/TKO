import { Link } from "wouter";
import { Plus, Search, Trophy, ArrowUpDown, Calendar, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TournamentCard } from "@/components/tournament-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { LayoutShell } from "@/components/layout-shell";
import { useTournaments, useDeleteTournament } from "@/hooks/use-tournaments";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { format } from "date-fns";
import type { Tournament } from "@shared/schema";

type SortOption = "eventDate" | "createdAt" | "updatedAt";

const sortLabels: Record<SortOption, string> = {
  eventDate: "Date of Tournament",
  createdAt: "Date Created",
  updatedAt: "Last Modified",
};

const typeLabels: Record<string, string> = {
  ROUND_ROBIN: "Round Robin",
  KNOCKOUT: "Knockout",
  DOUBLE_ELIMINATION: "Double Elim",
  MULTI_STAGE: "Multi-Stage",
};

function sortTournaments(list: any[], sortBy: SortOption) {
  return [...list].sort((a, b) => {
    if (sortBy === "eventDate") {
      if (a.eventDate && b.eventDate) return b.eventDate.localeCompare(a.eventDate);
      if (a.eventDate) return -1;
      if (b.eventDate) return 1;
      const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bCreated - aCreated;
    }
    if (sortBy === "createdAt") {
      const aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bVal - aVal;
    }
    if (sortBy === "updatedAt") {
      const aVal = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bVal = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bVal - aVal;
    }
    return 0;
  });
}

function TournamentListRow({ tournament }: { tournament: Tournament }) {
  const { toast } = useToast();
  const deleteMutation = useDeleteTournament();
  const dateStr = tournament.eventDate
    ? format(new Date(tournament.eventDate + 'T00:00:00'), 'MMM d, yyyy')
    : tournament.createdAt
      ? format(new Date(tournament.createdAt), 'MMM d, yyyy')
      : '';

  const handleDelete = () => {
    deleteMutation.mutate(tournament.id, {
      onSuccess: () => {
        toast({ title: "Tournament deleted", description: `"${tournament.name}" has been removed.` });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to delete tournament.", variant: "destructive" });
      },
    });
  };

  return (
    <Card className="flex items-center gap-4 px-4 py-3 hover-elevate transition-all" data-testid={`list-row-tournament-${tournament.id}`}>
      <Link href={`/tournaments/${tournament.id}`} className="flex-1 min-w-0 cursor-pointer">
        <p className="font-medium text-sm" data-testid={`text-list-name-${tournament.id}`}>{tournament.name}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {dateStr}
          </span>
          <span className="flex items-center gap-1">
            <Trophy className="w-3 h-3" />
            {typeLabels[tournament.type] || tournament.type}
          </span>
        </div>
      </Link>
      <div className="flex items-center gap-2 shrink-0">
        {tournament.isLegacy && (
          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800 text-xs">
            LEGACY
          </Badge>
        )}
        {tournament.status === 'COMPLETED' && !tournament.isLegacy && (
          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 text-xs">
            COMPLETED
          </Badge>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              data-testid={`button-delete-list-tournament-${tournament.id}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Tournament</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{tournament.name}"? This will permanently remove the tournament, all players, matches, and results. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Link href={`/tournaments/${tournament.id}`}>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </Link>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { data: tournaments, isLoading } = useTournaments();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("eventDate");

  const filtered = tournaments
    ?.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  const sorted = filtered ? sortTournaments(filtered, sortBy) : [];

  return (
    <LayoutShell>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight" data-testid="text-dashboard-title">My Tournaments</h1>
            <p className="text-muted-foreground mt-1">Manage and track all your dart events.</p>
          </div>
          <Link href="/create">
            <Button size="lg" className="shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all" data-testid="button-create-tournament">
              <Plus className="w-5 h-5 mr-2" />
              Create Tournament
            </Button>
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search tournaments..."
              className="pl-10 h-12 text-lg bg-card border-border/50 shadow-sm rounded-xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-tournaments"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="h-12 w-full sm:w-56 bg-card border-border/50 shadow-sm rounded-xl" data-testid="select-sort-tournaments">
              <ArrowUpDown className="w-4 h-4 mr-2 text-muted-foreground shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(sortLabels) as SortOption[]).map(key => (
                <SelectItem key={key} value={key}>{sortLabels[key]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48 rounded-2xl" />
              ))}
            </div>
            <div className="space-y-2">
              {[4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-2xl border border-dashed">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold font-display" data-testid="text-no-tournaments">No tournaments found</h3>
            <p className="text-muted-foreground mt-2 mb-6">Get started by creating your first tournament.</p>
            <Link href="/create">
              <Button data-testid="button-create-first">Create Tournament</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sorted.slice(0, 3).map((tournament: any) => (
                <TournamentCard key={tournament.id} tournament={tournament} />
              ))}
            </div>
            {sorted.length > 3 && (
              <div className="space-y-2">
                {sorted.slice(3).map((tournament: any) => (
                  <TournamentListRow key={tournament.id} tournament={tournament} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </LayoutShell>
  );
}
