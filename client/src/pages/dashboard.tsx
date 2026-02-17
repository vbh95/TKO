import { Link } from "wouter";
import { Plus, Search, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LayoutShell } from "@/components/layout-shell";
import { TournamentCard } from "@/components/tournament-card";
import { useTournaments } from "@/hooks/use-tournaments";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";

export default function Dashboard() {
  const { data: tournaments, isLoading } = useTournaments();
  const [search, setSearch] = useState("");

  const filteredTournaments = tournaments
    ?.filter(t => !t.isLegacy && t.status !== 'COMPLETED')
    .filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <LayoutShell>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">My Tournaments</h1>
            <p className="text-muted-foreground mt-1">Manage and track all your dart events.</p>
          </div>
          <Link href="/create">
            <Button size="lg" className="shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
              <Plus className="w-5 h-5 mr-2" />
              Create Tournament
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input 
            placeholder="Search tournaments..." 
            className="pl-10 h-12 text-lg bg-card border-border/50 shadow-sm rounded-xl"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 rounded-2xl" />
            ))}
          </div>
        ) : filteredTournaments?.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-2xl border border-dashed">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold font-display">No tournaments found</h3>
            <p className="text-muted-foreground mt-2 mb-6">Get started by creating your first tournament.</p>
            <Link href="/create">
              <Button>Create Tournament</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTournaments?.map((tournament) => (
              <TournamentCard key={tournament.id} tournament={tournament} />
            ))}
          </div>
        )}
      </div>
    </LayoutShell>
  );
}
