import { useState } from "react";
import { useParams, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Trophy, Calendar, ArrowUpCircle, ArrowDownCircle, X, Target, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import tkoLogoFull from "@assets/TKO_White-04_1771178906649.png";

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

interface PlayerMatch {
  tournamentName: string;
  tournamentId: number;
  eventDate: string | null;
  opponent: string;
  scoreFor: number;
  scoreAgainst: number;
  won: boolean;
  stage: string;
  roundKey: string;
  bestOf: number;
  stats: {
    threeDartAvg: string | null;
    checkoutPct: string | null;
    highestFinish: number | null;
    highestVisit: number | null;
    ton80s: number | null;
    ton40s: number | null;
    tons: number | null;
  } | null;
}

interface PublicLeagueData {
  league: {
    name: string;
    startDate: string | null;
    endDate: string | null;
    promotionCount: number;
    relegationCount: number;
  };
  tournaments: Array<{ id: number; name: string; status: string; eventDate: string | null }>;
  standings: StandingRow[];
  playerMatches: Record<string, PlayerMatch[]>;
}

function getRoundDisplayName(roundKey: string): string {
  switch (roundKey) {
    case 'QF': return 'Quarter-Final';
    case 'SF': return 'Semi-Final';
    case 'F': return 'Final';
    case 'R16': return 'Round of 16';
    case 'R32': return 'Round of 32';
    default:
      if (roundKey.startsWith('R')) return `Round ${roundKey.replace('R', '')}`;
      return roundKey;
  }
}

function getMatchSortOrder(stage: string, roundKey: string): number {
  if (roundKey === 'F' || stage === 'GRAND_FINAL') return 1000;
  if (roundKey === 'SF') return 900;
  if (roundKey === 'QF') return 800;
  if (roundKey === 'R16') return 700;
  if (roundKey === 'R32') return 600;
  if (stage === 'GROUP') {
    const roundNum = parseInt(roundKey.replace('R', ''), 10);
    return isNaN(roundNum) ? 100 : 100 + roundNum;
  }
  const num = parseInt(roundKey.replace('R', ''), 10);
  return isNaN(num) ? 50 : 50 + num;
}

function getStageLabel(stage: string, roundKey: string): string {
  if (stage === 'GROUP') return `Group — ${getRoundDisplayName(roundKey)}`;
  if (stage === 'GRAND_FINAL') return 'Grand Final';
  return getRoundDisplayName(roundKey);
}

export default function PublicLeague() {
  const { shareToken } = useParams();
  const searchString = useSearch();
  const isEmbed = new URLSearchParams(searchString).get('embed') === 'true';
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<PublicLeagueData>({
    queryKey: ['/api/public/league', shareToken],
    queryFn: async () => {
      const res = await fetch(`/api/public/league/${shareToken}`);
      if (!res.ok) throw new Error("League not found");
      return res.json();
    },
    enabled: !!shareToken,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Trophy className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">League Not Found</h2>
          <p className="text-muted-foreground">This league link may be invalid or has been removed.</p>
        </div>
      </div>
    );
  }

  const { league, tournaments, standings, playerMatches } = data;
  const promoCount = league.promotionCount || 0;
  const relegCount = league.relegationCount || 0;
  const totalPlayers = standings.length;

  const getRowZone = (position: number): 'promotion' | 'relegation' | null => {
    if (promoCount > 0 && position <= promoCount) return 'promotion';
    if (relegCount > 0 && totalPlayers > 0 && position > totalPlayers - relegCount) return 'relegation';
    return null;
  };

  const selectedPlayerKey = selectedPlayer ? selectedPlayer.replace(/\s+/g, ' ').toLowerCase().trim() : null;
  const selectedMatches = selectedPlayerKey ? (playerMatches[selectedPlayerKey] || []) : [];

  const sortedMatches = [...selectedMatches].sort((a, b) => {
    const dateA = a.eventDate ? new Date(a.eventDate).getTime() : 0;
    const dateB = b.eventDate ? new Date(b.eventDate).getTime() : 0;
    return dateB - dateA;
  });

  const matchesByTournament: Record<string, PlayerMatch[]> = {};
  const tournamentOrder: string[] = [];
  for (const m of sortedMatches) {
    const key = m.tournamentName;
    if (!matchesByTournament[key]) {
      matchesByTournament[key] = [];
      tournamentOrder.push(key);
    }
    matchesByTournament[key].push(m);
  }
  for (const key of tournamentOrder) {
    matchesByTournament[key].sort((a, b) => getMatchSortOrder(b.stage, b.roundKey) - getMatchSortOrder(a.stage, a.roundKey));
  }

  const totalWins = selectedMatches.filter(m => m.won).length;
  const totalLosses = selectedMatches.filter(m => !m.won).length;

  const playerAvg = (() => {
    const avgs = selectedMatches
      .map(m => m.stats?.threeDartAvg)
      .filter((v): v is string => v != null && v !== '')
      .map(v => parseFloat(v))
      .filter(v => !isNaN(v));
    if (avgs.length === 0) return null;
    return (avgs.reduce((sum, a) => sum + a, 0) / avgs.length).toFixed(2);
  })();

  return (
    <div className={cn("min-h-screen bg-background text-foreground overflow-x-hidden", isEmbed && "p-0")}>
      {!isEmbed && (
        <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <img src={tkoLogoFull} alt="TKO" className="h-6 sm:h-8" />
              <span className="text-muted-foreground text-sm">League Standings</span>
            </div>
            <Badge variant="outline" className="text-xs gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              Live
            </Badge>
          </div>
        </header>
      )}

      <div className={cn("max-w-5xl mx-auto w-full", isEmbed ? "p-1 sm:p-2" : "px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6")}>
        {!isEmbed && (
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight" data-testid="text-public-league-title">
              {league.name}
            </h1>
            <div className="flex items-center gap-4 flex-wrap">
              {(league.startDate || league.endDate) && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {league.startDate && league.endDate
                    ? `${format(new Date(league.startDate), 'MMM d, yyyy')} — ${format(new Date(league.endDate), 'MMM d, yyyy')}`
                    : league.startDate
                      ? `From ${format(new Date(league.startDate), 'MMM d, yyyy')}`
                      : `Ends ${format(new Date(league.endDate!), 'MMM d, yyyy')}`
                  }
                </span>
              )}
              <span className="text-sm text-muted-foreground">
                {tournaments.length} tournament{tournaments.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}

        {!isEmbed && (
          <div className="flex flex-col gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-xs sm:text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Points:</span>
              <span>Group — 5</span>
              <span className="text-border">|</span>
              <span>QF — 10</span>
              <span className="text-border">|</span>
              <span>SF — 20</span>
              <span className="text-border">|</span>
              <span>RU — 30</span>
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
        )}

        {standings.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Trophy className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-1">No standings yet</h3>
              <p className="text-muted-foreground text-sm">Results will appear here once tournaments are played.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 sm:w-14 text-center px-2">#</TableHead>
                    <TableHead className="px-2">Player</TableHead>
                    <TableHead className="text-center px-2 w-12 sm:w-auto">
                      <span className="hidden sm:inline">Wins</span>
                      <span className="sm:hidden">W</span>
                    </TableHead>
                    <TableHead className="text-center px-2 w-12 sm:w-auto">
                      <span className="hidden sm:inline">Points</span>
                      <span className="sm:hidden">Pts</span>
                    </TableHead>
                    <TableHead className="text-center px-1 w-10 sm:w-auto">
                      <span className="hidden sm:inline">Legs Won</span>
                      <span className="sm:hidden">LW</span>
                    </TableHead>
                    <TableHead className="text-center px-1 w-10 sm:w-auto">
                      <span className="hidden sm:inline">Leg Diff</span>
                      <span className="sm:hidden">LD</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standings.map((row) => {
                    const zone = getRowZone(row.position);
                    return (
                      <TableRow
                        key={row.position}
                        className={cn(
                          "cursor-pointer hover:bg-muted/50 transition-colors",
                          zone === 'promotion' && "bg-green-500/10 dark:bg-green-500/10",
                          zone === 'relegation' && "bg-red-500/10 dark:bg-red-500/10",
                        )}
                        onClick={() => setSelectedPlayer(row.name)}
                        data-testid={`row-standing-${row.position}`}
                      >
                        <TableCell className="text-center font-bold tabular-nums px-1">
                          <div className="flex items-center justify-center gap-0.5 sm:gap-1">
                            {zone === 'promotion' && <ArrowUpCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-600 dark:text-green-400" />}
                            {zone === 'relegation' && <ArrowDownCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-600 dark:text-red-400" />}
                            {row.position}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium px-1 max-w-[80px] sm:max-w-none">
                          <button
                            className="text-left hover:text-primary transition-colors underline decoration-dotted underline-offset-4 text-[13px] sm:text-base truncate block w-full"
                            onClick={(e) => { e.stopPropagation(); setSelectedPlayer(row.name); }}
                            data-testid={`button-player-${row.position}`}
                          >
                            {row.name}
                          </button>
                        </TableCell>
                        <TableCell className="text-center tabular-nums px-1">
                          {row.wins > 0 ? (
                            <span className="inline-flex items-center gap-0.5 sm:gap-1 text-amber-600 dark:text-amber-400 font-semibold text-[13px] sm:text-base">
                              <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              {row.wins}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[13px] sm:text-base">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center tabular-nums font-bold text-primary text-[14px] sm:text-lg px-1">{row.points}</TableCell>
                        <TableCell className="text-center tabular-nums px-1 text-[13px] sm:text-base">{row.legsWon}</TableCell>
                        <TableCell className="text-center tabular-nums px-1 text-[13px] sm:text-base">
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

        {!isEmbed && (
          <p className="text-xs text-center text-muted-foreground pt-4">
            Powered by TKO — Ultimate Tournament Generator
          </p>
        )}
      </div>

      <Dialog open={!!selectedPlayer} onOpenChange={(open) => !open && setSelectedPlayer(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              {selectedPlayer}
            </DialogTitle>
          </DialogHeader>

          {selectedMatches.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No matches found for this player.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-3 sm:gap-4 text-sm flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {selectedMatches.length} match{selectedMatches.length !== 1 ? 'es' : ''}
                </Badge>
                <span className="text-green-600 dark:text-green-400 font-medium">{totalWins}W</span>
                <span className="text-red-600 dark:text-red-400 font-medium">{totalLosses}L</span>
                <span className="text-muted-foreground">—</span>
                <span className="text-foreground font-medium">Tournament Avg: {playerAvg || 'N/A'}</span>
              </div>

              {tournamentOrder.map((tournamentName) => {
                const matches = matchesByTournament[tournamentName];
                return (
                <div key={tournamentName} className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                    <Trophy className="w-3.5 h-3.5 text-primary" />
                    {tournamentName}
                    {matches[0]?.eventDate && (
                      <span className="font-normal text-xs">
                        ({format(new Date(matches[0].eventDate), 'MMM d, yyyy')})
                      </span>
                    )}
                  </h3>
                  <div className="space-y-1">
                    {matches.map((match, idx) => (
                      <MatchRow key={idx} match={match} playerName={selectedPlayer!} />
                    ))}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MatchRow({ match, playerName }: { match: PlayerMatch; playerName: string }) {
  const [expanded, setExpanded] = useState(false);
  const hasStats = match.stats && (match.stats.threeDartAvg || match.stats.ton80s !== null);
  const isFinalWin = match.won && (match.roundKey === 'F' || match.stage === 'GRAND_FINAL');

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 text-sm transition-colors",
          match.won ? "bg-green-500/5 hover:bg-green-500/10" : "bg-red-500/5 hover:bg-red-500/10"
        )}
        onClick={() => hasStats && setExpanded(!expanded)}
        data-testid={`match-row-${match.opponent}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn(
            "text-xs font-bold px-1.5 py-0.5 rounded",
            match.won ? "bg-green-500/20 text-green-600 dark:text-green-400" : "bg-red-500/20 text-red-600 dark:text-red-400"
          )}>
            {match.won ? 'W' : 'L'}
          </span>
          {isFinalWin && <Trophy className="w-3.5 h-3.5 text-amber-500" />}
          <span className="font-medium truncate">vs {match.opponent}</span>
          <span className="text-xs text-muted-foreground shrink-0">
            ({getStageLabel(match.stage, match.roundKey)})
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-bold tabular-nums">
            {match.scoreFor} - {match.scoreAgainst}
          </span>
          {hasStats && (
            expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>
      </button>
      {expanded && match.stats && (
        <div className="border-t px-3 py-2 bg-muted/30">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {match.stats.threeDartAvg && (
              <div>
                <span className="text-muted-foreground">3-Dart Avg</span>
                <p className="font-semibold">{match.stats.threeDartAvg}</p>
              </div>
            )}
            {match.stats.checkoutPct && (
              <div>
                <span className="text-muted-foreground">Checkout %</span>
                <p className="font-semibold">{match.stats.checkoutPct}%</p>
              </div>
            )}
            {match.stats.highestFinish != null && (
              <div>
                <span className="text-muted-foreground">Highest Finish</span>
                <p className="font-semibold">{match.stats.highestFinish}</p>
              </div>
            )}
            {match.stats.highestVisit != null && (
              <div>
                <span className="text-muted-foreground">Highest Visit</span>
                <p className="font-semibold">{match.stats.highestVisit}</p>
              </div>
            )}
            {match.stats.ton80s != null && match.stats.ton80s > 0 && (
              <div>
                <span className="text-muted-foreground">180s</span>
                <p className="font-semibold">{match.stats.ton80s}</p>
              </div>
            )}
            {match.stats.ton40s != null && match.stats.ton40s > 0 && (
              <div>
                <span className="text-muted-foreground">140+</span>
                <p className="font-semibold">{match.stats.ton40s}</p>
              </div>
            )}
            {match.stats.tons != null && match.stats.tons > 0 && (
              <div>
                <span className="text-muted-foreground">100+</span>
                <p className="font-semibold">{match.stats.tons}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
