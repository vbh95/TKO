import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Trophy, Calendar, Users, ArrowRight, Trash2, Settings, Loader2, AlertTriangle, Medal, UserCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useDeleteTournament } from "@/hooks/use-tournaments";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Tournament } from "@shared/schema";

export function TournamentCard({ tournament }: { tournament: Tournament & { isCollaborator?: boolean; isOwner?: boolean } }) {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const deleteMutation = useDeleteTournament();
  const { toast } = useToast();
  const isCollaborator = (tournament as any).isCollaborator === true;

  const { data: leaguesList = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ['/api/leagues'],
  });
  const leagueName = tournament.leagueId
    ? leaguesList.find(l => l.id === tournament.leagueId)?.name
    : null;

  const statusColors: Record<string, string> = {
    NOT_STARTED: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
    IN_PROGRESS: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
    COMPLETED: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
  };

  const typeLabels: Record<string, string> = {
    ROUND_ROBIN: "Round Robin",
    KNOCKOUT: "Knockout",
    DOUBLE_ELIMINATION: "Double Elimination",
    MULTI_STAGE: "Multi-Stage",
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
        <div className="flex flex-wrap justify-between items-start gap-2">
          <div className="space-y-1 min-w-0 flex-1 basis-[60%]">
            <h3 className="font-display font-bold text-xl text-foreground group-hover:text-primary transition-colors break-words">
              {tournament.name}
            </h3>
            {leagueName && (
              <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <Medal className="w-3.5 h-3.5 text-primary" />
                <span data-testid={`text-league-name-${tournament.id}`}>{leagueName}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {tournament.eventDate
                ? format(new Date(tournament.eventDate + 'T00:00:00'), 'MMM d, yyyy')
                : tournament.createdAt ? format(new Date(tournament.createdAt), 'MMM d, yyyy') : 'Date unknown'}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isCollaborator && (
              <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800 gap-1 text-xs">
                <UserCheck className="w-3 h-3" />
                CO-ADMIN
              </Badge>
            )}
            {tournament.isLegacy ? (
              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
                LEGACY
              </Badge>
            ) : (
              <Badge variant="outline" className={statusColors[tournament.status] || statusColors.IN_PROGRESS}>
                {tournament.status.replace('_', ' ')}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
              data-testid={`button-settings-tournament-${tournament.id}`}
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setSettingsOpen(true); }}
            >
              <Settings className="w-4 h-4" />
            </Button>
            {!isCollaborator && (
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
            )}
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

      <TournamentSettingsDialog
        tournament={tournament}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </Card>
  );
}

function TournamentSettingsDialog({ tournament, open, onOpenChange }: { tournament: Tournament; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [showResetWarning, setShowResetWarning] = useState(false);
  const [leagueSaving, setLeagueSaving] = useState(false);

  const { data: leaguesList = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ['/api/leagues'],
    enabled: open,
  });
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("none");

  const settings = (tournament.settings || {}) as any;

  const [name, setName] = useState(tournament.name);
  const [eventDate, setEventDate] = useState(tournament.eventDate || "");
  const [groupCount, setGroupCount] = useState(settings.groupCount || 1);
  const [groupBestOf, setGroupBestOf] = useState(settings.groupBestOf || 3);
  const [knockoutBestOf, setKnockoutBestOf] = useState(settings.knockoutBestOf || 5);
  const [qfBestOf, setQfBestOf] = useState(settings.knockoutBestOfByRound?.quarterFinal || 5);
  const [sfBestOf, setSfBestOf] = useState(settings.knockoutBestOfByRound?.semiFinal || 7);
  const [fBestOf, setFBestOf] = useState(settings.knockoutBestOfByRound?.final || 9);
  const [pointsForWin, setPointsForWin] = useState(settings.pointsForWin ?? 2);
  const [pointsForLoss, setPointsForLoss] = useState(settings.pointsForLoss ?? 0);
  const [seeded, setSeeded] = useState(settings.seeded ?? true);

  useEffect(() => {
    if (open) {
      const s = (tournament.settings || {}) as any;
      setName(tournament.name);
      setEventDate(tournament.eventDate || "");
      setGroupCount(s.groupCount || 1);
      setGroupBestOf(s.groupBestOf || 3);
      setKnockoutBestOf(s.knockoutBestOf || 5);
      setQfBestOf(s.knockoutBestOfByRound?.quarterFinal || 5);
      setSfBestOf(s.knockoutBestOfByRound?.semiFinal || 7);
      setFBestOf(s.knockoutBestOfByRound?.final || 9);
      setPointsForWin(s.pointsForWin ?? 2);
      setPointsForLoss(s.pointsForLoss ?? 0);
      setSeeded(s.seeded ?? true);
      setShowResetWarning(false);
      setSelectedLeagueId(tournament.leagueId?.toString() ?? "none");
    }
  }, [open, tournament]);

  const type = tournament.type;
  const hasGroups = type === "ROUND_ROBIN" || type === "MULTI_STAGE";
  const hasKnockout = type === "KNOCKOUT" || type === "DOUBLE_ELIMINATION" || type === "MULTI_STAGE";
  const isActive = tournament.status === "IN_PROGRESS" || tournament.status === "COMPLETED";

  const buildNewSettings = () => {
    const newSettings = { ...settings };
    if (hasGroups) {
      newSettings.groupCount = groupCount;
      newSettings.groupBestOf = groupBestOf;
      newSettings.pointsForWin = pointsForWin;
      newSettings.pointsForLoss = pointsForLoss;
    }
    if (hasKnockout) {
      newSettings.knockoutBestOfByRound = {
        quarterFinal: qfBestOf,
        semiFinal: sfBestOf,
        final: fBestOf,
      };
      newSettings.seeded = seeded;
      if (type === "DOUBLE_ELIMINATION") {
        newSettings.knockoutBestOf = knockoutBestOf;
      }
    }
    return newSettings;
  };

  const hasStructuralChanges = () => {
    const s = (tournament.settings || {}) as any;
    if (hasGroups) {
      if (groupCount !== (s.groupCount || 1)) return true;
      if (groupBestOf !== (s.groupBestOf || 3)) return true;
      if (pointsForWin !== (s.pointsForWin ?? 2)) return true;
      if (pointsForLoss !== (s.pointsForLoss ?? 0)) return true;
    }
    if (hasKnockout) {
      if (qfBestOf !== (s.knockoutBestOfByRound?.quarterFinal || 5)) return true;
      if (sfBestOf !== (s.knockoutBestOfByRound?.semiFinal || 7)) return true;
      if (fBestOf !== (s.knockoutBestOfByRound?.final || 9)) return true;
      if (seeded !== (s.seeded ?? true)) return true;
      if (type === "DOUBLE_ELIMINATION" && knockoutBestOf !== (s.knockoutBestOf || 5)) return true;
    }
    return false;
  };

  const handleSave = () => {
    if (isActive && hasStructuralChanges()) {
      setShowResetWarning(true);
      return;
    }
    doSave(false);
  };

  const doSave = async (reset: boolean) => {
    setSaving(true);
    setShowResetWarning(false);
    try {
      const newSettings = buildNewSettings();

      if (reset) {
        await apiRequest('POST', `/api/tournaments/${tournament.id}/reset`, {
          name,
          settings: newSettings,
          eventDate: eventDate || null,
        });
      } else {
        await apiRequest('PUT', `/api/tournaments/${tournament.id}`, {
          name,
          settings: newSettings,
          eventDate: eventDate || null,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['/api/tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments/:id', tournament.id] });

      toast({
        title: reset ? "Tournament restarted" : "Settings saved",
        description: reset
          ? "All results have been cleared and the tournament has restarted with new settings."
          : "Tournament settings have been updated.",
      });
      onOpenChange(false);
    } catch {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Tournament Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="space-y-2">
            <Label htmlFor="settings-name">Tournament Name</Label>
            <Input
              id="settings-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11"
              data-testid="input-settings-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-event-date">Tournament Date</Label>
            <Input
              id="settings-event-date"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="h-11"
              data-testid="input-settings-event-date"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Medal className="w-4 h-4" />
              League
            </Label>
            <div className="flex items-center gap-2">
              <Select value={selectedLeagueId} onValueChange={setSelectedLeagueId}>
                <SelectTrigger className="h-10 flex-1" data-testid="select-settings-league">
                  <SelectValue placeholder="No league" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No league</SelectItem>
                  {leaguesList.map(l => (
                    <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedLeagueId !== (tournament.leagueId?.toString() ?? "none") && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={leagueSaving}
                  data-testid="button-save-league-setting"
                  onClick={async () => {
                    setLeagueSaving(true);
                    try {
                      const lid = selectedLeagueId === "none" ? null : parseInt(selectedLeagueId);
                      await apiRequest('PUT', `/api/tournaments/${tournament.id}/league`, { leagueId: lid });
                      queryClient.invalidateQueries({ queryKey: ['/api/tournaments'] });
                      queryClient.invalidateQueries({ queryKey: ['/api/tournaments/:id', tournament.id] });
                      queryClient.invalidateQueries({ queryKey: ['/api/leagues'] });
                      toast({ title: lid ? "Added to league" : "Removed from league" });
                    } catch {
                      toast({ title: "Error", description: "Failed to update league.", variant: "destructive" });
                    } finally {
                      setLeagueSaving(false);
                    }
                  }}
                >
                  {leagueSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                </Button>
              )}
            </div>
            {leaguesList.length === 0 && (
              <p className="text-xs text-muted-foreground">Create leagues from the Leagues page first.</p>
            )}
          </div>

          <Separator />

          <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" />
            Format: {typeLabels[type] || type}
          </div>

          {hasGroups && (
            <div className="space-y-4 border rounded-xl p-4 bg-muted/20">
              <Label className="text-sm font-bold">Group Stage</Label>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="settings-groupCount" className="text-xs">Number of Groups</Label>
                  <Select value={groupCount.toString()} onValueChange={(v) => setGroupCount(parseInt(v))}>
                    <SelectTrigger id="settings-groupCount" className="h-10" data-testid="select-group-count">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 4, 8].map(n => (
                        <SelectItem key={n} value={n.toString()}>{n} Group{n > 1 ? 's' : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="settings-groupBestOf" className="text-xs">Match Format</Label>
                  <Select value={groupBestOf.toString()} onValueChange={(v) => setGroupBestOf(parseInt(v))}>
                    <SelectTrigger id="settings-groupBestOf" className="h-10" data-testid="select-group-best-of">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 3, 5, 7, 9, 11].map(n => (
                        <SelectItem key={n} value={n.toString()}>Best of {n} legs</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="settings-ptsWin" className="text-xs">Points for Win</Label>
                    <Input
                      id="settings-ptsWin"
                      type="number"
                      min={0}
                      max={10}
                      value={pointsForWin}
                      onChange={(e) => setPointsForWin(parseInt(e.target.value) || 0)}
                      className="h-10"
                      data-testid="input-settings-pts-win"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="settings-ptsLoss" className="text-xs">Points for Loss</Label>
                    <Input
                      id="settings-ptsLoss"
                      type="number"
                      min={0}
                      max={10}
                      value={pointsForLoss}
                      onChange={(e) => setPointsForLoss(parseInt(e.target.value) || 0)}
                      className="h-10"
                      data-testid="input-settings-pts-loss"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {hasKnockout && (
            <div className="space-y-4 border rounded-xl p-4 bg-muted/20">
              <Label className="text-sm font-bold">Knockout Stage</Label>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Quarter Finals</Label>
                    <Select value={qfBestOf.toString()} onValueChange={(v) => setQfBestOf(parseInt(v))}>
                      <SelectTrigger className="h-10" data-testid="select-qf-best-of">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 3, 5, 7, 9, 11, 21].map(n => (
                          <SelectItem key={n} value={n.toString()}>Best of {n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Semi Finals</Label>
                    <Select value={sfBestOf.toString()} onValueChange={(v) => setSfBestOf(parseInt(v))}>
                      <SelectTrigger className="h-10" data-testid="select-sf-best-of">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 3, 5, 7, 9, 11, 21].map(n => (
                          <SelectItem key={n} value={n.toString()}>Best of {n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Grand Final</Label>
                    <Select value={fBestOf.toString()} onValueChange={(v) => setFBestOf(parseInt(v))}>
                      <SelectTrigger className="h-10" data-testid="select-final-best-of">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 3, 5, 7, 9, 11, 21].map(n => (
                          <SelectItem key={n} value={n.toString()}>Best of {n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {type === "DOUBLE_ELIMINATION" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Other Bracket Matches</Label>
                    <Select value={knockoutBestOf.toString()} onValueChange={(v) => setKnockoutBestOf(parseInt(v))}>
                      <SelectTrigger className="h-10" data-testid="select-knockout-best-of">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 3, 5, 7, 9, 11, 21].map(n => (
                          <SelectItem key={n} value={n.toString()}>Best of {n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {(type === "KNOCKOUT" || type === "MULTI_STAGE") && (
                  <div className="flex items-center justify-between pt-1">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Seeded Bracket</Label>
                      <p className="text-xs text-muted-foreground">Highest seeds play lowest seeds</p>
                    </div>
                    <Switch checked={seeded} onCheckedChange={setSeeded} data-testid="switch-seeded" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {showResetWarning && (
          <div className="border-2 border-destructive/50 bg-destructive/10 rounded-xl p-4 space-y-3" data-testid="reset-warning">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-sm text-destructive">Warning: This will restart the tournament</p>
                <p className="text-xs text-muted-foreground">
                  Saving these changes will reset all match results, scores, and progress. 
                  The tournament will start again from scratch with the updated settings. 
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowResetWarning(false)}
                data-testid="button-cancel-reset"
              >
                Go Back
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => doSave(true)}
                disabled={saving || !name.trim()}
                data-testid="button-confirm-reset"
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Reset & Restart Tournament
              </Button>
            </div>
          </div>
        )}

        {!showResetWarning && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-settings">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()} data-testid="button-save-settings">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

const typeLabels: Record<string, string> = {
  ROUND_ROBIN: "Round Robin",
  KNOCKOUT: "Knockout",
  DOUBLE_ELIMINATION: "Double Elimination",
  MULTI_STAGE: "Multi-Stage",
};
