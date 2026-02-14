import { useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Trophy, Calendar, Users, ArrowRight, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useDeleteTournament } from "@/hooks/use-tournaments";
import { useToast } from "@/hooks/use-toast";
import type { Tournament } from "@shared/schema";

export function TournamentCard({ tournament }: { tournament: Tournament }) {
  const [open, setOpen] = useState(false);
  const deleteMutation = useDeleteTournament();
  const { toast } = useToast();

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

  const handleDelete = () => {
    deleteMutation.mutate(tournament.id, {
      onSuccess: () => {
        toast({ title: "Tournament deleted", description: `"${tournament.name}" has been removed.` });
        setOpen(false);
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to delete tournament. Please try again.", variant: "destructive" });
      },
    });
  };

  return (
    <Card className="group overflow-hidden hover:shadow-xl transition-all duration-300 border-border/50">
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1 min-w-0 flex-1">
            <h3 className="font-display font-bold text-xl text-foreground group-hover:text-primary transition-colors truncate">
              {tournament.name}
            </h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              {tournament.createdAt ? format(new Date(tournament.createdAt), 'MMM d, yyyy') : 'Date unknown'}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-2 shrink-0">
            <Badge variant="outline" className={statusColors[tournament.status as keyof typeof statusColors]}>
              {tournament.status.replace('_', ' ')}
            </Badge>
            <AlertDialog open={open} onOpenChange={setOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  data-testid={`button-delete-tournament-${tournament.id}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
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
          </div>
        </div>

        <div className="flex items-center gap-4 py-2">
          <div className="flex items-center gap-1.5 text-sm font-medium bg-muted/50 px-3 py-1.5 rounded-lg">
            <Trophy className="w-4 h-4 text-primary" />
            {typeLabels[tournament.type]}
          </div>
          <div className="flex items-center gap-1.5 text-sm font-medium bg-muted/50 px-3 py-1.5 rounded-lg">
            <Users className="w-4 h-4 text-primary" />
            Players
          </div>
        </div>

        <div className="pt-2">
          <Link href={`/tournaments/${tournament.id}`}>
            <Button className="w-full justify-between group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300" data-testid={`button-view-tournament-${tournament.id}`}>
              View Tournament
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
