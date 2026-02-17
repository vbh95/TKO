import { Search, History, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LayoutShell } from "@/components/layout-shell";
import { TournamentCard } from "@/components/tournament-card";
import { useTournaments } from "@/hooks/use-tournaments";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

type SortOption = "eventDate" | "createdAt" | "updatedAt";

const sortLabels: Record<SortOption, string> = {
  eventDate: "Date of Tournament",
  createdAt: "Date Created",
  updatedAt: "Last Modified",
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

export default function LegacyPage() {
  const { data: tournaments, isLoading } = useTournaments();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("eventDate");

  const filtered = tournaments
    ?.filter(t => t.isLegacy || t.status === 'COMPLETED')
    .filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  const legacyTournaments = filtered ? sortTournaments(filtered, sortBy) : [];

  return (
    <LayoutShell>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight" data-testid="text-legacy-title">Legacy Tournaments</h1>
            <p className="text-muted-foreground mt-1">Completed and Past Tournaments</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search tournaments..."
              className="pl-10 h-12 text-lg bg-card border-border/50 shadow-sm rounded-xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-legacy"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="h-12 w-full sm:w-56 bg-card border-border/50 shadow-sm rounded-xl" data-testid="select-sort-legacy">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 rounded-2xl" />
            ))}
          </div>
        ) : legacyTournaments.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-2xl border border-dashed">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <History className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold font-display" data-testid="text-no-legacy">No tournaments here yet</h3>
            <p className="text-muted-foreground mt-2">Completed tournaments and legacy entries will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {legacyTournaments.map((tournament: any) => (
              <TournamentCard key={tournament.id} tournament={tournament} />
            ))}
          </div>
        )}
      </div>
    </LayoutShell>
  );
}
