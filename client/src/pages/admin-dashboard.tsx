import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { LayoutShell } from "@/components/layout-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/components/ui/dialog";
import {
  Users,
  Trophy,
  Target,
  MessageSquare,
  UserPlus,
  TrendingUp,
  Wifi,
  Search,
  Clock,
  ExternalLink,
  Shield,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Bell,
  ArrowUpDown,
  Loader2,
  Send,
  Lock,
  LockOpen,
  Trash2,
  KeyRound,
  X,
  MoreHorizontal,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const CATEGORY_COLORS: Record<string, string> = {
  "Bug Report": "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  "Feature Request": "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  "Usability Issue": "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  "General Feedback": "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  low: { label: "Low", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30", icon: Info },
  medium: { label: "Medium", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30", icon: AlertTriangle },
  high: { label: "High", color: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30", icon: AlertCircle },
  critical: { label: "Critical", color: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30", icon: AlertCircle },
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  investigating: "Investigating",
  resolved: "Resolved",
};

interface ConnectedUser {
  userId: number;
  name: string;
  email: string;
  tournamentId: number | null;
  tournamentName: string | null;
}

interface LiveTournament {
  id: number;
  name: string;
  type: string;
  ownerName: string;
  playerCount: number;
  totalMatches: number;
  completedMatches: number;
  shareEnabled: boolean;
  shareToken: string | null;
}

interface AdminUser {
  id: number;
  name: string;
  email: string;
  createdAt: string | null;
  isSuperUser: boolean;
  isLocked: boolean;
  deletedAt: string | null;
}

interface UserTournament {
  id: number;
  name: string;
  type: string;
  status: string;
  createdAt: string | null;
}

interface AdminLogEntry {
  id: number;
  adminId: number | null;
  adminEmail: string | null;
  targetEmail: string | null;
  action: string | null;
  detail: string | null;
  createdAt: string | null;
}

interface FeedbackItem {
  id: number;
  userId: number | null;
  category: string;
  message: string;
  page: string | null;
  status: string;
  severity: string | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string | null;
  userName: string | null;
  userEmail: string | null;
}

type SortKey = "date" | "severity" | "name";

const SEVERITY_ORDER: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, "": 0 };

function sortFeedback(items: FeedbackItem[], key: SortKey): FeedbackItem[] {
  return [...items].sort((a, b) => {
    if (key === "date") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (key === "severity") return (SEVERITY_ORDER[b.severity || ""] || 0) - (SEVERITY_ORDER[a.severity || ""] || 0);
    if (key === "name") return (a.userName || "").localeCompare(b.userName || "");
    return 0;
  });
}

function NotifyDialog({
  feedback,
  onClose,
}: {
  feedback: FeedbackItem;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [notificationType, setNotificationType] = useState<string>("investigating");
  const [customMessage, setCustomMessage] = useState("");

  const notify = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/admin/feedback/${feedback.id}/notify`, {
        notificationType,
        customMessage: customMessage || null,
      });
    },
    onSuccess: () => {
      toast({ title: "Notification sent", description: "The user has been notified." });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message || "Could not send notification", variant: "destructive" });
    },
  });

  const typeLabels: Record<string, string> = {
    investigating: "Being Investigated",
    resolved: "Issue Resolved",
    update: "General Update",
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Notify User
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground line-clamp-2">
            "{feedback.message}"
          </div>
          {!feedback.userId ? (
            <p className="text-sm text-destructive">This feedback was submitted anonymously — no user to notify.</p>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Notification Type</label>
                <Select value={notificationType} onValueChange={setNotificationType}>
                  <SelectTrigger data-testid="select-notify-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="investigating">Being Investigated</SelectItem>
                    <SelectItem value="resolved">Issue Resolved</SelectItem>
                    <SelectItem value="update">General Update</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Custom Message <span className="text-muted-foreground font-normal">(optional)</span></label>
                <Textarea
                  placeholder="Add a personal message to the user..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={3}
                  data-testid="input-notify-message"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button
                  onClick={() => notify.mutate()}
                  disabled={notify.isPending}
                  className="gap-1.5"
                  data-testid="button-send-notification"
                >
                  {notify.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send Notification
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FeedbackCard({ item, onUpdate }: { item: FeedbackItem; onUpdate: () => void }) {
  const { toast } = useToast();
  const [notifyOpen, setNotifyOpen] = useState(false);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<{ status: string; severity: string | null }>) => {
      return apiRequest("PATCH", `/api/admin/feedback/${item.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/feedback"] });
      onUpdate();
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  const sevConfig = item.severity ? SEVERITY_CONFIG[item.severity] : null;

  return (
    <>
      <div
        className={cn(
          "border rounded-lg p-4 space-y-3",
          item.status === "resolved" && "opacity-70"
        )}
        data-testid={`feedback-item-${item.id}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={cn("text-xs", CATEGORY_COLORS[item.category])}>
              {item.category}
            </Badge>
            {sevConfig && (
              <Badge variant="outline" className={cn("text-xs gap-1", sevConfig.color)}>
                <sevConfig.icon className="w-3 h-3" />
                {sevConfig.label}
              </Badge>
            )}
            <span className="text-sm font-medium">{item.userName || "Anonymous"}</span>
            {item.userEmail && (
              <span className="text-xs text-muted-foreground">{item.userEmail}</span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
            <Clock className="w-3 h-3" />
            {item.createdAt ? format(new Date(item.createdAt), "dd MMM yyyy HH:mm") : "Unknown"}
          </div>
        </div>

        <p className="text-sm leading-relaxed">{item.message}</p>

        {item.page && (
          <p className="text-xs text-muted-foreground">
            Page: <span className="font-mono">{item.page}</span>
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap border-t pt-3">
          <Select
            value={item.status}
            onValueChange={(val) => updateMutation.mutate({ status: val })}
          >
            <SelectTrigger className="h-7 text-xs w-auto min-w-[120px]" data-testid={`select-status-${item.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="investigating">Investigating</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={item.severity || "none"}
            onValueChange={(val) => updateMutation.mutate({ severity: val === "none" ? null : val })}
          >
            <SelectTrigger className="h-7 text-xs w-auto min-w-[110px]" data-testid={`select-severity-${item.id}`}>
              <SelectValue placeholder="Set severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Severity</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>

          {item.status !== "resolved" && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 text-green-600 border-green-500/40 hover:bg-green-500/10"
              onClick={() => updateMutation.mutate({ status: "resolved" })}
              data-testid={`button-resolve-${item.id}`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Mark Resolved
            </Button>
          )}

          {item.userId && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 ml-auto"
              onClick={() => setNotifyOpen(true)}
              data-testid={`button-notify-${item.id}`}
            >
              <Bell className="w-3.5 h-3.5" />
              Notify User
            </Button>
          )}
        </div>
      </div>

      {notifyOpen && <NotifyDialog feedback={item} onClose={() => setNotifyOpen(false)} />}
    </>
  );
}

export default function AdminDashboard() {
  const [feedbackSearch, setFeedbackSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [userSearch, setUserSearch] = useState("");
  const [liveUsersExpanded, setLiveUsersExpanded] = useState(false);
  const [viewingUserTournaments, setViewingUserTournaments] = useState<AdminUser | null>(null);
  const { toast } = useToast();

  const { data: stats } = useQuery<{
    totalUsers: number;
    totalTournaments: number;
    tournamentsByStatus: Record<string, number>;
    totalMatches: number;
    totalFeedback: number;
    feedbackByCategory: Record<string, number>;
    recentSignups: number;
    recentTournaments: number;
  }>({ queryKey: ["/api/admin/stats"] });

  const { data: feedback, isLoading: feedbackLoading, refetch: refetchFeedback } = useQuery<FeedbackItem[]>({
    queryKey: ["/api/admin/feedback"],
  });

  const { data: liveStats } = useQuery<{ connectedUsers: number }>({
    queryKey: ["/api/admin/live-stats"],
    refetchInterval: 10000,
  });

  const { data: connectedUsers } = useQuery<ConnectedUser[]>({
    queryKey: ["/api/admin/connected-users"],
    refetchInterval: 10000,
  });

  const { data: liveTournaments } = useQuery<LiveTournament[]>({
    queryKey: ["/api/admin/live-tournaments"],
    refetchInterval: 15000,
  });

  const { data: allUsers } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: inviteCodeData, refetch: refetchInviteCode } = useQuery<{ enabled: boolean; codeSet: boolean }>({
    queryKey: ["/api/admin/invite-code"],
  });

  const { data: adminLogs } = useQuery<AdminLogEntry[]>({
    queryKey: ["/api/admin/logs"],
    refetchInterval: 30000,
  });

  const { data: userTournaments, isLoading: userTournamentsLoading } = useQuery<UserTournament[]>({
    queryKey: [`/api/admin/users/${viewingUserTournaments?.id}/tournaments`],
    enabled: !!viewingUserTournaments,
  });

  const lockUserMutation = useMutation({
    mutationFn: async ({ id, locked }: { id: number; locked: boolean }) => {
      return apiRequest("PATCH", `/api/admin/users/${id}/lock`, { locked });
    },
    onSuccess: (_data, { locked }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/logs"] });
      toast({ title: locked ? "User locked" : "User unlocked", description: locked ? "The user can no longer log in." : "The user can now log in again." });
    },
    onError: (err: any) => {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/logs"] });
      toast({ title: "User deleted", description: "The user account has been soft-deleted." });
    },
    onError: (err: any) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const [confirmAction, setConfirmAction] = useState<{
    type: "lock" | "unlock" | "delete";
    user: AdminUser;
  } | null>(null);

  const [inviteCodeNewValue, setInviteCodeNewValue] = useState("");
  const [inviteCodeSaving, setInviteCodeSaving] = useState(false);
  const [inviteToggling, setInviteToggling] = useState(false);
  const [logsExpanded, setLogsExpanded] = useState(false);

  const saveInviteCode = async () => {
    if (!inviteCodeNewValue.trim()) return;
    setInviteCodeSaving(true);
    try {
      await apiRequest("POST", "/api/admin/invite-code", { code: inviteCodeNewValue.trim(), enabled: inviteCodeData?.enabled ?? false });
      await refetchInviteCode();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/logs"] });
      setInviteCodeNewValue("");
      toast({ title: "Invite code saved", description: "The invite code has been updated." });
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    } finally {
      setInviteCodeSaving(false);
    }
  };

  const toggleInviteCode = async () => {
    setInviteToggling(true);
    try {
      const newEnabled = !(inviteCodeData?.enabled ?? false);
      await apiRequest("PATCH", "/api/admin/invite-code/toggle", { enabled: newEnabled });
      await refetchInviteCode();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/logs"] });
      toast({ title: newEnabled ? "Invite code enabled" : "Invite code disabled" });
    } catch (err: any) {
      toast({ title: "Failed to toggle", description: err.message, variant: "destructive" });
    } finally {
      setInviteToggling(false);
    }
  };

  const connectedUserIds = new Set((connectedUsers || []).map(u => u.userId));

  const baseFiltered = (feedback || []).filter((f) => {
    const matchesCategory = categoryFilter === "all" || f.category === categoryFilter;
    const matchesSearch =
      !feedbackSearch ||
      f.message.toLowerCase().includes(feedbackSearch.toLowerCase()) ||
      (f.userName || "").toLowerCase().includes(feedbackSearch.toLowerCase()) ||
      (f.userEmail || "").toLowerCase().includes(feedbackSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const activeFeedback = sortFeedback(baseFiltered.filter(f => f.status === "active"), sortKey);
  const investigatingFeedback = sortFeedback(baseFiltered.filter(f => f.status === "investigating"), sortKey);
  const resolvedFeedback = sortFeedback(baseFiltered.filter(f => f.status === "resolved"), sortKey);

  const filteredUsers = (allUsers || []).filter((u) => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <LayoutShell>
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold" data-testid="text-admin-title">Beta Logs</h1>
          <p className="text-muted-foreground mt-1">Monitor beta activity, feedback, and platform health</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card data-testid="stat-card-live-users" className="col-span-1">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Live Users</p>
                  <p className="text-3xl font-bold mt-1">{liveStats?.connectedUsers ?? 0}</p>
                </div>
                <button
                  className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center relative cursor-pointer"
                  onClick={() => setLiveUsersExpanded(!liveUsersExpanded)}
                  data-testid="button-toggle-live-users"
                >
                  <Wifi className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                </button>
              </div>
              {liveUsersExpanded && (
                <div className="mt-3 border-t pt-3 space-y-2">
                  {connectedUsers && connectedUsers.length > 0 ? connectedUsers.map((u, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full shrink-0" />
                      <span className="font-medium truncate">{u.name}</span>
                      {u.tournamentName && <span className="text-muted-foreground truncate">— {u.tournamentName}</span>}
                    </div>
                  )) : (
                    <p className="text-xs text-muted-foreground">No identified users connected</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="stat-card-total-users">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Users</p>
                  <p className="text-3xl font-bold mt-1">{stats?.totalUsers ?? 0}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                <UserPlus className="w-3 h-3 inline mr-1" />
                {stats?.recentSignups ?? 0} this week
              </p>
            </CardContent>
          </Card>

          <Card data-testid="stat-card-tournaments">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Tournaments</p>
                  <p className="text-3xl font-bold mt-1">{stats?.totalTournaments ?? 0}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-primary" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                <TrendingUp className="w-3 h-3 inline mr-1" />
                {stats?.recentTournaments ?? 0} this week
              </p>
            </CardContent>
          </Card>

          <Card data-testid="stat-card-matches">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Matches</p>
                  <p className="text-3xl font-bold mt-1">{stats?.totalMatches ?? 0}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Target className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {liveTournaments && liveTournaments.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <CardTitle className="text-lg">Live Tournaments</CardTitle>
                <Badge variant="secondary" className="tabular-nums">{liveTournaments.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {liveTournaments.map((t) => {
                  const progress = t.totalMatches > 0 ? Math.round((t.completedMatches / t.totalMatches) * 100) : 0;
                  return (
                    <div key={t.id} className="border rounded-lg p-4 space-y-3" data-testid={`live-tournament-${t.id}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-semibold text-sm truncate">{t.name}</h4>
                          <p className="text-xs text-muted-foreground">{t.ownerName}</p>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">{t.type.replace(/_/g, ' ')}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{t.playerCount} players</span>
                        <span>{t.completedMatches}/{t.totalMatches} matches</span>
                      </div>
                      <div className="space-y-1">
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground text-right">{progress}%</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5 text-xs"
                        onClick={() => window.open(`/tournaments/${t.id}`, '_blank')}
                        data-testid={`button-view-live-${t.id}`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View Tournament
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Tournaments by Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(stats.tournamentsByStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{status.replace(/_/g, " ")}</span>
                    <Badge variant="secondary" className="tabular-nums">{count}</Badge>
                  </div>
                ))}
                {Object.keys(stats.tournamentsByStatus).length === 0 && (
                  <p className="text-sm text-muted-foreground">No tournaments yet</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Feedback by Category</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(stats.feedbackByCategory).map(([category, count]) => (
                  <div key={category} className="flex items-center justify-between">
                    <Badge variant="outline" className={cn("text-xs", CATEGORY_COLORS[category])}>{category}</Badge>
                    <span className="text-sm font-medium tabular-nums">{count}</span>
                  </div>
                ))}
                {Object.keys(stats.feedbackByCategory).length === 0 && (
                  <p className="text-sm text-muted-foreground">No feedback yet</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Registered Users</CardTitle>
                <Badge variant="secondary" className="tabular-nums">{allUsers?.length ?? 0}</Badge>
              </div>
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-9 h-9"
                  data-testid="input-search-users"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-center">Joined</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {allUsers && allUsers.length > 0 ? "No users match your search" : "No users yet"}
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.map((user) => (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`} className={cn(user.deletedAt && "opacity-50")}>
                      <TableCell>
                        <span className={cn("w-2 h-2 rounded-full inline-block", connectedUserIds.has(user.id) ? "bg-green-500" : "bg-muted-foreground/30")} />
                      </TableCell>
                      <TableCell className="font-medium">
                        <button
                          className="hover:underline text-left"
                          onClick={() => setViewingUserTournaments(user)}
                          data-testid={`button-view-user-${user.id}`}
                        >
                          {user.name}
                        </button>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{user.email}</TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {user.createdAt ? format(new Date(user.createdAt), "dd MMM yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {user.isSuperUser && (
                            <Badge variant="default" className="text-xs gap-1">
                              <Shield className="w-3 h-3" />
                              Admin
                            </Badge>
                          )}
                          {user.deletedAt && (
                            <Badge variant="outline" className="text-xs text-destructive border-destructive/40">
                              Deleted
                            </Badge>
                          )}
                          {user.isLocked && !user.deletedAt && (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/40">
                              <Lock className="w-3 h-3 mr-1" />
                              Locked
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!user.isSuperUser && !user.deletedAt && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={cn("h-7 w-7 p-0", user.isLocked ? "text-amber-600 hover:text-amber-700" : "text-muted-foreground hover:text-foreground")}
                                onClick={() => setConfirmAction({ type: user.isLocked ? "unlock" : "lock", user })}
                                disabled={lockUserMutation.isPending}
                                title={user.isLocked ? "Unlock user" : "Lock user"}
                                data-testid={`button-lock-${user.id}`}
                              >
                                {user.isLocked ? <LockOpen className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive/70 hover:text-destructive"
                                onClick={() => setConfirmAction({ type: "delete", user })}
                                disabled={deleteUserMutation.isPending}
                                title="Delete user"
                                data-testid={`button-delete-user-${user.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Signup Settings</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Require invitation code</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  When enabled, new signups must provide a valid code.
                </p>
              </div>
              <button
                role="switch"
                aria-checked={inviteCodeData?.enabled ?? false}
                onClick={toggleInviteCode}
                disabled={inviteToggling || !inviteCodeData?.codeSet}
                data-testid="switch-invite-code-enabled"
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                  inviteCodeData?.enabled ? "bg-primary" : "bg-muted",
                  (inviteToggling || !inviteCodeData?.codeSet) && "opacity-50 cursor-not-allowed"
                )}
              >
                <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", inviteCodeData?.enabled ? "translate-x-6" : "translate-x-1")} />
              </button>
            </div>

            {!inviteCodeData?.codeSet && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Set a code below before enabling.
              </p>
            )}
            {inviteCodeData?.enabled && inviteCodeData?.codeSet && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Invite code active — new signups require the code.
              </p>
            )}
            {inviteCodeData !== undefined && !inviteCodeData?.enabled && inviteCodeData?.codeSet && (
              <p className="text-xs text-green-600 dark:text-green-400">
                Open signup — code set but not required.
              </p>
            )}

            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-2">
                {inviteCodeData?.codeSet ? "Regenerate invite code" : "Set invite code"}
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 max-w-sm">
                  <Input
                    placeholder="Enter or generate a code…"
                    value={inviteCodeNewValue}
                    onChange={(e) => setInviteCodeNewValue(e.target.value)}
                    data-testid="input-invite-code-admin"
                    type="text"
                    autoComplete="off"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
                    let code = "";
                    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
                    setInviteCodeNewValue(code);
                  }}
                  data-testid="button-generate-invite-code"
                  title="Generate a random code"
                >
                  Generate
                </Button>
                <Button
                  onClick={saveInviteCode}
                  disabled={inviteCodeSaving || !inviteCodeNewValue.trim()}
                  data-testid="button-save-invite-code"
                >
                  {inviteCodeSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Save
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                The code is stored as a secure hash — it cannot be retrieved after saving.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Feedback & Reports</CardTitle>
                <Badge variant="secondary" className="tabular-nums">{(feedback || []).length}</Badge>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={feedbackSearch}
                    onChange={(e) => setFeedbackSearch(e.target.value)}
                    className="pl-9 h-9 w-40"
                    data-testid="input-search-feedback"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[150px] h-9" data-testid="select-category-filter">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="Bug Report">Bug Report</SelectItem>
                    <SelectItem value="Feature Request">Feature Request</SelectItem>
                    <SelectItem value="Usability Issue">Usability Issue</SelectItem>
                    <SelectItem value="General Feedback">General Feedback</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                  <SelectTrigger className="w-[140px] h-9" data-testid="select-sort-feedback">
                    <ArrowUpDown className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date Submitted</SelectItem>
                    <SelectItem value="severity">Severity</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {feedbackLoading ? (
              <div className="text-center py-8 text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading feedback...
              </div>
            ) : (
              <Tabs defaultValue="active">
                <TabsList className="mb-4">
                  <TabsTrigger value="active" className="gap-1.5" data-testid="tab-active">
                    Active
                    {activeFeedback.length > 0 && (
                      <Badge variant="secondary" className="text-xs h-4 min-w-4 px-1">{activeFeedback.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="investigating" className="gap-1.5" data-testid="tab-investigating">
                    Investigating
                    {investigatingFeedback.length > 0 && (
                      <Badge variant="secondary" className="text-xs h-4 min-w-4 px-1">{investigatingFeedback.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="resolved" className="gap-1.5" data-testid="tab-resolved">
                    Resolved
                    {resolvedFeedback.length > 0 && (
                      <Badge variant="secondary" className="text-xs h-4 min-w-4 px-1">{resolvedFeedback.length}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                {[
                  { key: "active", items: activeFeedback },
                  { key: "investigating", items: investigatingFeedback },
                  { key: "resolved", items: resolvedFeedback },
                ].map(({ key, items }) => (
                  <TabsContent key={key} value={key}>
                    {items.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        {(feedback || []).length > 0 ? `No ${key} feedback matches your filters` : "No feedback submitted yet"}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {items.map((item) => (
                          <FeedbackCard
                            key={item.id}
                            item={item}
                            onUpdate={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/feedback"] })}
                          />
                        ))}
                      </div>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Admin Audit Log</CardTitle>
                <Badge variant="secondary" className="tabular-nums">{(adminLogs || []).length}</Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLogsExpanded(!logsExpanded)}
                data-testid="button-toggle-logs"
              >
                {logsExpanded ? "Collapse" : "Expand"}
              </Button>
            </div>
          </CardHeader>
          {logsExpanded && (
            <CardContent>
              {(adminLogs || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No audit log entries yet.</p>
              ) : (
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {(adminLogs || []).map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 text-xs border-b last:border-b-0 py-2"
                      data-testid={`log-entry-${entry.id}`}
                    >
                      <span className="text-muted-foreground shrink-0 tabular-nums">
                        {entry.createdAt ? format(new Date(entry.createdAt), "dd MMM HH:mm") : "—"}
                      </span>
                      <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs shrink-0">{entry.action ?? "—"}</span>
                      <div className="min-w-0">
                        {entry.adminEmail && (
                          <span className="text-muted-foreground">{entry.adminEmail}</span>
                        )}
                        {entry.targetEmail && (
                          <span className="text-muted-foreground"> → {entry.targetEmail}</span>
                        )}
                        {entry.detail && (
                          <span className="text-foreground/70 ml-1 truncate">— {entry.detail}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </div>

      {confirmAction && (
        <Dialog open onOpenChange={(o) => !o && setConfirmAction(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {confirmAction.type === "delete" ? (
                  <Trash2 className="w-5 h-5 text-destructive" />
                ) : confirmAction.type === "lock" ? (
                  <Lock className="w-5 h-5 text-amber-500" />
                ) : (
                  <LockOpen className="w-5 h-5 text-green-500" />
                )}
                {confirmAction.type === "delete" ? "Delete user?" :
                  confirmAction.type === "lock" ? "Lock user?" : "Unlock user?"}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {confirmAction.type === "delete"
                ? `This will soft-delete ${confirmAction.user.name}'s account. They will no longer be able to log in. This cannot be undone from the UI.`
                : confirmAction.type === "lock"
                ? `${confirmAction.user.name} will be immediately logged out and unable to sign in until unlocked.`
                : `${confirmAction.user.name} will be able to sign in again.`}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setConfirmAction(null)} data-testid="button-confirm-cancel">
                Cancel
              </Button>
              <Button
                variant={confirmAction.type === "delete" ? "destructive" : "default"}
                data-testid="button-confirm-ok"
                disabled={lockUserMutation.isPending || deleteUserMutation.isPending}
                onClick={() => {
                  if (confirmAction.type === "delete") {
                    deleteUserMutation.mutate(confirmAction.user.id, { onSettled: () => setConfirmAction(null) });
                  } else {
                    lockUserMutation.mutate(
                      { id: confirmAction.user.id, locked: confirmAction.type === "lock" },
                      { onSettled: () => setConfirmAction(null) }
                    );
                  }
                }}
              >
                {(lockUserMutation.isPending || deleteUserMutation.isPending) && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                )}
                {confirmAction.type === "delete" ? "Delete" : confirmAction.type === "lock" ? "Lock" : "Unlock"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {viewingUserTournaments && (
        <Dialog open onOpenChange={(o) => !o && setViewingUserTournaments(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                Viewing as {viewingUserTournaments.name}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">{viewingUserTournaments.email}</p>
            </DialogHeader>
            <div className="space-y-4 max-h-[26rem] overflow-y-auto">
              {userTournamentsLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </div>
              ) : (userTournaments || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No tournaments found.</p>
              ) : (["IN_PROGRESS", "NOT_STARTED", "COMPLETED"] as const).map((statusGroup) => {
                const group = (userTournaments || []).filter(t => t.status === statusGroup);
                if (group.length === 0) return null;
                const label = statusGroup === "IN_PROGRESS" ? "In Progress" : statusGroup === "NOT_STARTED" ? "Not Started" : "Completed";
                return (
                  <div key={statusGroup}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{label}</p>
                    <div className="space-y-1.5">
                      {group.map((t) => (
                        <div key={t.id} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm" data-testid={`user-tournament-${t.id}`}>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{t.name}</p>
                            <p className="text-xs text-muted-foreground">{t.type.replace(/_/g, " ")}</p>
                          </div>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => window.open(`/tournaments/${t.id}`, "_blank")} title="Open tournament">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end pt-2 border-t">
              <Button variant="outline" onClick={() => setViewingUserTournaments(null)} data-testid="button-view-as-back">
                Back
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </LayoutShell>
  );
}
