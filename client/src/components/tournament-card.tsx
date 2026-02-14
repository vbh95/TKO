import { Link } from "wouter";
import { format } from "date-fns";
import { Trophy, Calendar, Users, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Tournament } from "@shared/schema";

export function TournamentCard({ tournament }: { tournament: Tournament }) {
  const statusColors = {
    NOT_STARTED: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
    IN_PROGRESS: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
    COMPLETED: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
  };

  const typeLabels: Record<string, string> = {
    ROUND_ROBIN: "Round Robin",
    KNOCKOUT: "Knockout",
    DOUBLE_ELIMINATION: "Double Elimination",
  };

  return (
    <Card className="group overflow-hidden hover:shadow-xl transition-all duration-300 border-border/50">
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h3 className="font-display font-bold text-xl text-foreground group-hover:text-primary transition-colors">
              {tournament.name}
            </h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              {tournament.createdAt ? format(new Date(tournament.createdAt), 'MMM d, yyyy') : 'Date unknown'}
            </div>
          </div>
          <Badge variant="outline" className={statusColors[tournament.status as keyof typeof statusColors]}>
            {tournament.status.replace('_', ' ')}
          </Badge>
        </div>

        <div className="flex items-center gap-4 py-2">
          <div className="flex items-center gap-1.5 text-sm font-medium bg-muted/50 px-3 py-1.5 rounded-lg">
            <Trophy className="w-4 h-4 text-primary" />
            {typeLabels[tournament.type]}
          </div>
          {/* Placeholder for player count - in real app would join this data */}
          <div className="flex items-center gap-1.5 text-sm font-medium bg-muted/50 px-3 py-1.5 rounded-lg">
            <Users className="w-4 h-4 text-primary" />
            Players
          </div>
        </div>

        <div className="pt-2">
          <Link href={`/tournaments/${tournament.id}`}>
            <Button className="w-full justify-between group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
              View Tournament
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
