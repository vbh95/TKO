import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LayoutShell } from "@/components/layout-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  ChevronDown,
  ChevronUp,
  Shield,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const CATEGORY_COLORS: Record<string, string> = {
  "Bug Report": "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  "Feature Request": "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  "Usability Issue": "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  "General Feedback": "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
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
}

export default function AdminDashboard() {
  const [feedbackSearch, setFeedbackSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [userSearch, setUserSearch] = useState("");
  const [liveUsersExpanded, setLiveUsersExpanded] = useState(false);

  const { data: stats } = useQuery<{
    totalUsers: number;
    totalTournaments: number;
    tournamentsByStatus: Record<string, number>;
    totalMatches: number;
    totalFeedback: number;
    feedbackByCategory: Record<string, number>;
    recentSignups: number;
    recentTournaments: number;
  }>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: feedback, isLoading: feedbackLoading } = useQuery<Array<{
    id: number;
    userId: number | null;
    category: string;
    message: string;
    page: string | null;
    createdAt: string;
    userName: string | null;
    userEmail: string | null;
  }>>({
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

  const connectedUserIds = new Set((connectedUsers || []).map(u => u.userId));

  const filteredFeedback = (feedback || []).filter((f) => {
    const matchesCategory = categoryFilter === "all" || f.category === categoryFilter;
    const matchesSearch =
      !feedbackSearch ||
      f.message.toLowerCase().includes(feedbackSearch.toLowerCase()) ||
      (f.userName || "").toLowerCase().includes(feedbackSearch.toLowerCase()) ||
      (f.userEmail || "").toLowerCase().includes(feedbackSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

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
                  <span className="absolute w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                </button>
              </div>
              {liveUsersExpanded && connectedUsers && connectedUsers.length > 0 && (
                <div className="mt-3 border-t pt-3 space-y-2">
                  {connectedUsers.map((u, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full shrink-0" />
                      <span className="font-medium truncate">{u.name}</span>
                      {u.tournamentName && (
                        <span className="text-muted-foreground truncate">— {u.tournamentName}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {liveUsersExpanded && (!connectedUsers || connectedUsers.length === 0) && (
                <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">No identified users connected</p>
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
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground text-right">{progress}%</p>
                      </div>
                      {t.shareToken ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-1.5 text-xs"
                          onClick={() => window.open(`/public/${t.shareToken}`, '_blank')}
                          data-testid={`button-view-live-${t.id}`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View Live
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-1.5 text-xs"
                          onClick={() => window.open(`/tournaments/${t.id}`, '_blank')}
                          data-testid={`button-view-tournament-${t.id}`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View Tournament
                        </Button>
                      )}
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
                    <Badge variant="outline" className={cn("text-xs", CATEGORY_COLORS[category])}>
                      {category}
                    </Badge>
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
                    <TableHead className="text-center">Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        {allUsers && allUsers.length > 0 ? "No users match your search" : "No users yet"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                        <TableCell>
                          <span className={cn(
                            "w-2 h-2 rounded-full inline-block",
                            connectedUserIds.has(user.id) ? "bg-green-500" : "bg-muted-foreground/30"
                          )} />
                        </TableCell>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{user.email}</TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {user.createdAt ? format(new Date(user.createdAt), "dd MMM yyyy") : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {user.isSuperUser && (
                            <Badge variant="default" className="text-xs gap-1">
                              <Shield className="w-3 h-3" />
                              Admin
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Feedback & Reports</CardTitle>
                <Badge variant="secondary" className="tabular-nums">{filteredFeedback.length}</Badge>
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search feedback..."
                    value={feedbackSearch}
                    onChange={(e) => setFeedbackSearch(e.target.value)}
                    className="pl-9 h-9"
                    data-testid="input-search-feedback"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[160px] h-9" data-testid="select-category-filter">
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
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {feedbackLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading feedback...</div>
            ) : filteredFeedback.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {feedback && feedback.length > 0 ? "No feedback matches your filters" : "No feedback submitted yet"}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFeedback.map((item) => (
                  <div
                    key={item.id}
                    className="border rounded-lg p-4 space-y-2"
                    data-testid={`feedback-item-${item.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={cn("text-xs", CATEGORY_COLORS[item.category])}>
                          {item.category}
                        </Badge>
                        <span className="text-sm font-medium">{item.userName || "Unknown User"}</span>
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
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </LayoutShell>
  );
}
