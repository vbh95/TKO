import { Search, History } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LayoutShell } from "@/components/layout-shell";
import { TournamentCard } from "@/components/tournament-card";
import { useTournaments } from "@/hooks/use-tournaments";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { format } from "date-fns";

export default function LegacyPage() {
  const { data: tournaments, isLoading } = useTournaments();
  const [search, setSearch] = useState("");

  const legacyTournaments = tournaments
    ?.filter(t => t.isLegacy || t.status === 'COMPLETED')
    .filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (a.eventDate && b.eventDate) return b.eventDate.localeCompare(a.eventDate);
      if (a.eventDate) return -1;
      if (b.eventDate) return 1;
      return 0;
    });

  return (
    <LayoutShell>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight" data-testid="text-legacy-title">Legacy Tournaments</h1>
            <p className="text-muted-foreground mt-1">Completed and Past Tournaments</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search legacy tournaments..."
            className="pl-10 h-12 text-lg bg-card border-border/50 shadow-sm rounded-xl"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-legacy"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 rounded-2xl" />
            ))}
          </div>
        ) : legacyTournaments?.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-2xl border border-dashed">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <History className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold font-display" data-testid="text-no-legacy">No tournaments here yet</h3>
            <p className="text-muted-foreground mt-2">Completed tournaments and legacy entries will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {legacyTournaments?.map((tournament) => (
              <TournamentCard key={tournament.id} tournament={tournament} />
            ))}
          </div>
        )}
      </div>
    </LayoutShell>
  );
}
