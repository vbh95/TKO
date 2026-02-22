import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useState } from "react";
import { format } from "date-fns";
import { LayoutShell } from "@/components/layout-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Loader2, ArrowLeft, Trophy, Calendar, ArrowUpCircle, ArrowDownCircle, Share2, Copy, Check, Code } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";

interface League {
  id: number;
  name: string;
  userId: number;
  startDate: string | null;
  endDate: string | null;
  promotionCount: number;
  relegationCount: number;
  createdAt: string;
  shareToken: string | null;
}

interface StandingRow {
  position: number;
  name: string;
  wins: number;
  points: number;
  legsWon: number;
  legsLost: number;
  legDifference: number;
  tournaments: number;
}

interface LeagueStandings {
  league: League;
  tournaments: Array<{ id: number; name: string; status: string }>;
  standings: StandingRow[];
  shareToken: string | null;
}

export default function LeagueDetail() {
  const [, params] = useRoute("/leagues/:id");
  const leagueId = params?.id ? parseInt(params.id) : 0;
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const { toast } = useToast();
  const { data, isLoading, error } = useQuery<LeagueStandings>({
    queryKey: ['/api/leagues/:id/standings', leagueId],
    queryFn: async () => {
      const res = await fetch(`/api/leagues/${leagueId}/standings`, { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch standings");
      return res.json();
    },
    enabled: leagueId > 0,
  });

  if (isLoading) {
    return (
      <LayoutShell>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </LayoutShell>
    );
  }

  if (error || !data) {
    return (
      <LayoutShell>
        <div className="text-center py-20">
          <p className="text-muted-foreground">League not found.</p>
          <Link href="/leagues">
            <Button variant="outline" className="mt-4">Back to Leagues</Button>
          </Link>
        </div>
      </LayoutShell>
    );
  }

  const { league, tournaments, standings, shareToken } = data;
  const publicUrl = shareToken ? `${window.location.origin}/public/league/${shareToken}` : null;
  const embedCode = publicUrl ? `<iframe src="${publicUrl}?embed=true" width="100%" height="600" frameborder="0" style="border-radius: 8px;"></iframe>` : null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast({ title: "Copied!", description: `${label} copied to clipboard.` });
    setTimeout(() => setCopied(null), 2000);
  };

  const promoCount = league.promotionCount || 0;
  const relegCount = league.relegationCount || 0;
  const totalPlayers = standings.length;

  const getRowZone = (position: number): 'promotion' | 'relegation' | null => {
    if (promoCount > 0 && position <= promoCount) return 'promotion';
    if (relegCount > 0 && totalPlayers > 0 && position > totalPlayers - relegCount) return 'relegation';
    return null;
  };

  return (
    <LayoutShell>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/leagues">
            <Button variant="ghost" size="icon" data-testid="button-back-to-leagues">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight truncate" data-testid="text-league-detail-title">
              {league.name}
            </h1>
            <div className="flex items-center gap-4 mt-1 flex-wrap">
              {(league.startDate || league.endDate) ? (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {league.startDate && league.endDate
                    ? `${format(new Date(league.startDate), 'MMM d, yyyy')} — ${format(new Date(league.endDate), 'MMM d, yyyy')}`
                    : league.startDate
                      ? `From ${format(new Date(league.startDate), 'MMM d, yyyy')}`
                      : `Ends ${format(new Date(league.endDate!), 'MMM d, yyyy')}`
                  }
                </span>
              ) : (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Created {league.createdAt ? format(new Date(league.createdAt), 'MMM d, yyyy') : ''}
                </span>
              )}
            </div>
          </div>
          {publicUrl && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-2"
              onClick={() => setShareOpen(true)}
              data-testid="button-share-league"
            >
              <Share2 className="w-4 h-4" />
              Share Public Page
            </Button>
          )}
        </div>

        {tournaments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tournaments.map(t => (
              <Link key={t.id} href={`/tournaments/${t.id}`}>
                <Badge
                  variant={t.status === 'COMPLETED' ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  data-testid={`badge-tournament-${t.id}`}
                >
                  {t.name}
                  {t.status === 'IN_PROGRESS' && <span className="ml-1 w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />}
                </Badge>
              </Link>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 flex-wrap text-sm text-muted-foreground" data-testid="text-points-system">
            <span className="font-medium text-foreground">Points:</span>
            <span>Group Stage — 5</span>
            <span className="text-border">|</span>
            <span>QF — 10</span>
            <span className="text-border">|</span>
            <span>SF — 20</span>
            <span className="text-border">|</span>
            <span>Runner-Up — 30</span>
            <span className="text-border">|</span>
            <span>Winner — 40</span>
          </div>

          {(promoCount > 0 || relegCount > 0) && (
            <div className="flex items-center gap-4 flex-wrap">
              {promoCount > 0 && (
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="w-3 h-3 rounded-sm bg-green-500/20 border border-green-500/40" />
                  <span className="text-muted-foreground">Promotion (Top {promoCount})</span>
                </div>
              )}
              {relegCount > 0 && (
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="w-3 h-3 rounded-sm bg-red-500/20 border border-red-500/40" />
                  <span className="text-muted-foreground">Relegation (Bottom {relegCount})</span>
                </div>
              )}
            </div>
          )}
        </div>

        {standings.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Trophy className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-1">No standings yet</h3>
              <p className="text-muted-foreground text-sm">Add tournaments to this league to see standings.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14 text-center">Pos</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead className="text-center">Tournament Wins</TableHead>
                      <TableHead className="text-center">Points</TableHead>
                      <TableHead className="text-center">Legs Won</TableHead>
                      <TableHead className="text-center">Leg Diff</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {standings.map((row) => {
                      const zone = getRowZone(row.position);
                      return (
                        <TableRow
                          key={row.position}
                          className={cn(
                            zone === 'promotion' && "bg-green-500/10 dark:bg-green-500/10",
                            zone === 'relegation' && "bg-red-500/10 dark:bg-red-500/10",
                          )}
                          data-testid={`row-standing-${row.position}`}
                        >
                          <TableCell className="text-center font-bold tabular-nums">
                            <div className="flex items-center justify-center gap-1">
                              {zone === 'promotion' && <ArrowUpCircle className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />}
                              {zone === 'relegation' && <ArrowDownCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />}
                              {row.position}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-center tabular-nums">
                            {row.wins > 0 ? (
                              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold" data-testid={`text-wins-${row.position}`}>
                                <Trophy className="w-3.5 h-3.5" />
                                {row.wins}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center tabular-nums font-bold text-primary text-lg">{row.points}</TableCell>
                          <TableCell className="text-center tabular-nums">{row.legsWon}</TableCell>
                          <TableCell className="text-center tabular-nums">
                            <span className={cn(
                              row.legDifference > 0 && "text-green-600 dark:text-green-400",
                              row.legDifference < 0 && "text-red-600 dark:text-red-400",
                            )}>
                              {row.legDifference > 0 ? '+' : ''}{row.legDifference}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Scoring Criteria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              League positions are determined by the following criteria, applied in order:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 pl-1">
              <li><span className="font-medium text-foreground">Points</span> — Players are ranked by total points earned across all league tournaments. The player with the most points is ranked highest.</li>
              <li><span className="font-medium text-foreground">Legs Won</span> — If two or more players are tied on points, the player with the most legs won is ranked higher.</li>
              <li><span className="font-medium text-foreground">Leg Difference</span> — If still tied, the player with the better leg difference (legs won minus legs lost) is ranked higher.</li>
              <li><span className="font-medium text-foreground">Tournaments Attended</span> — If still tied, the player who has attended more tournaments is ranked higher.</li>
            </ol>
            <p className="text-xs text-muted-foreground/70 pt-1">
              If players remain tied after all criteria, they share the same effective position.
            </p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-primary" />
              Share League
            </DialogTitle>
          </DialogHeader>

          {publicUrl && (
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium">Public Link</label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={publicUrl}
                    className="flex-1 text-sm bg-muted px-3 py-2 rounded-md border font-mono truncate"
                    data-testid="input-public-league-url"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1"
                    onClick={() => copyToClipboard(publicUrl, 'Link')}
                    data-testid="button-copy-league-link"
                  >
                    {copied === 'Link' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied === 'Link' ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-primary"
                  onClick={() => window.open(publicUrl, '_blank')}
                  data-testid="button-open-public-league"
                >
                  Open in new tab
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Code className="w-3.5 h-3.5" />
                  Embed Code
                </label>
                <div className="bg-muted rounded-md border p-3">
                  <code className="text-xs font-mono break-all text-muted-foreground">
                    {embedCode}
                  </code>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => copyToClipboard(embedCode!, 'Embed code')}
                  data-testid="button-copy-embed-code"
                >
                  {copied === 'Embed code' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied === 'Embed code' ? 'Copied' : 'Copy Embed Code'}
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">QR Code</label>
                <div className="flex justify-center bg-white rounded-lg p-4">
                  <QRCodeSVG value={publicUrl} size={180} />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Scan to view league standings on any device
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </LayoutShell>
  );
}
