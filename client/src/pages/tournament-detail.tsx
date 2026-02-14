import { useState } from "react";
import { useParams, Link } from "wouter";
import { useTournament, useTournamentShare } from "@/hooks/use-tournaments";
import { LayoutShell } from "@/components/layout-shell";
import { MatchScoreInput } from "@/components/match-score-input";
import { 
  Loader2, 
  Share2, 
  Settings, 
  Trophy, 
  Copy, 
  Check, 
  ExternalLink 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { Match, Player } from "@shared/schema";
import { cn } from "@/lib/utils";

export default function TournamentDetail() {
  const { id } = useParams();
  const tournamentId = parseInt(id || "0");
  const { data, isLoading } = useTournament(tournamentId);
  const { enableShare, disableShare } = useTournamentShare(tournamentId);
  const { toast } = useToast();

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [copied, setCopied] = useState(false);

  if (isLoading || !data) {
    return (
      <LayoutShell>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      </LayoutShell>
    );
  }

  const { tournament, players, matches, groups } = data;

  const handleCopyLink = () => {
    const url = `${window.location.origin}/public/t/${tournament.shareToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Link copied to clipboard" });
  };

  const getPlayer = (id: number | null) => players.find(p => p.id === id) || null;

  // Group matches by round/group for display
  const matchesByRound = matches.reduce((acc, match) => {
    const key = match.groupId ? (groups.find(g => g.id === match.groupId)?.name || 'Group') : match.roundKey;
    if (!acc[key]) acc[key] = [];
    acc[key].push(match);
    return acc;
  }, {} as Record<string, typeof matches>);

  // Calculate standings
  const standings = players.map(player => {
    const playerMatches = matches.filter(m => 
      (m.playerAId === player.id || m.playerBId === player.id) && m.status === 'COMPLETED'
    );
    
    let played = 0, won = 0, lost = 0, legsFor = 0, legsAgainst = 0;
    
    playerMatches.forEach(m => {
      played++;
      const isA = m.playerAId === player.id;
      const myScore = isA ? (m.scoreA || 0) : (m.scoreB || 0);
      const oppScore = isA ? (m.scoreB || 0) : (m.scoreA || 0);
      
      legsFor += myScore;
      legsAgainst += oppScore;
      
      if (m.winnerId === player.id) won++;
      else lost++;
    });

    return {
      ...player,
      played, won, lost, legsFor, legsAgainst,
      diff: legsFor - legsAgainst,
      pts: won * 2 // Standard 2pts for win
    };
  }).sort((a, b) => b.pts - a.pts || b.diff - a.diff);

  return (
    <LayoutShell>
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-display font-bold tracking-tight">{tournament.name}</h1>
              <Badge variant="secondary" className="text-sm font-medium">
                {tournament.type}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">Created on {new Date(tournament.createdAt!).toLocaleDateString()}</p>
          </div>
          
          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Share2 className="w-4 h-4" />
                  Share
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Share Tournament</DialogTitle>
                  <DialogDescription>
                    Anyone with the link can view live scores and standings.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  {!tournament.shareEnabled ? (
                    <div className="text-center py-6">
                      <p className="text-sm text-muted-foreground mb-4">Public sharing is currently disabled.</p>
                      <Button onClick={() => enableShare.mutate()} disabled={enableShare.isPending}>
                        Generate Public Link
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <Input 
                          readOnly 
                          value={`${window.location.origin}/public/t/${tournament.shareToken}`} 
                        />
                        <Button size="icon" onClick={handleCopyLink}>
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                      <div className="flex justify-between">
                        <Button variant="link" asChild className="px-0">
                          <a href={`/public/t/${tournament.shareToken}`} target="_blank" rel="noopener noreferrer">
                            Open Public View <ExternalLink className="w-3 h-3 ml-1" />
                          </a>
                        </Button>
                        <Button 
                          variant="ghost" 
                          className="text-destructive hover:text-destructive/90"
                          onClick={() => disableShare.mutate()}
                        >
                          Disable Sharing
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            
            <Button variant="outline" size="icon">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue="matches" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
            <TabsTrigger value="matches">Matches</TabsTrigger>
            <TabsTrigger value="standings">Standings</TabsTrigger>
            <TabsTrigger value="players">Players</TabsTrigger>
          </TabsList>

          <TabsContent value="matches" className="space-y-6">
            {Object.entries(matchesByRound).map(([roundName, roundMatches]) => (
              <Card key={roundName}>
                <CardHeader>
                  <CardTitle className="text-lg font-bold">{roundName}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {roundMatches.map((match) => {
                    const playerA = getPlayer(match.playerAId);
                    const playerB = getPlayer(match.playerBId);
                    
                    return (
                      <div 
                        key={match.id}
                        onClick={() => setSelectedMatch(match)}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md hover:border-primary/50",
                          match.status === 'COMPLETED' ? "bg-muted/30" : "bg-card"
                        )}
                      >
                        <div className="flex-1 text-right font-medium">
                          {playerA?.name || "TBD"}
                        </div>
                        
                        <div className="flex items-center gap-3 px-6">
                          <div className={cn(
                            "w-8 h-8 flex items-center justify-center rounded-md font-bold text-lg",
                            match.scoreA! > match.scoreB! ? "bg-primary text-primary-foreground" : "bg-muted"
                          )}>
                            {match.scoreA || 0}
                          </div>
                          <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">vs</span>
                          <div className={cn(
                            "w-8 h-8 flex items-center justify-center rounded-md font-bold text-lg",
                            match.scoreB! > match.scoreA! ? "bg-primary text-primary-foreground" : "bg-muted"
                          )}>
                            {match.scoreB || 0}
                          </div>
                        </div>

                        <div className="flex-1 text-left font-medium">
                          {playerB?.name || "TBD"}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="standings">
            <Card>
              <CardHeader>
                <CardTitle>Leaderboard</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">#</TableHead>
                        <TableHead>Player</TableHead>
                        <TableHead className="text-center">P</TableHead>
                        <TableHead className="text-center">W</TableHead>
                        <TableHead className="text-center">L</TableHead>
                        <TableHead className="text-center hidden md:table-cell">Legs +/-</TableHead>
                        <TableHead className="text-right font-bold">Pts</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {standings.map((player, idx) => (
                        <TableRow key={player.id}>
                          <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-bold">{player.name}</TableCell>
                          <TableCell className="text-center">{player.played}</TableCell>
                          <TableCell className="text-center text-green-600">{player.won}</TableCell>
                          <TableCell className="text-center text-red-500">{player.lost}</TableCell>
                          <TableCell className="text-center hidden md:table-cell font-mono">
                            {player.diff > 0 ? `+${player.diff}` : player.diff}
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary text-lg">{player.pts}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="players">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {players.map((player) => (
                <Card key={player.id}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {player.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold">{player.name}</h4>
                      <p className="text-xs text-muted-foreground">Seed #{player.seed || '-'}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Score Dialog */}
        {selectedMatch && (
          <MatchScoreInput 
            match={selectedMatch}
            playerA={getPlayer(selectedMatch.playerAId)}
            playerB={getPlayer(selectedMatch.playerBId)}
            isOpen={!!selectedMatch}
            onClose={() => setSelectedMatch(null)}
          />
        )}
      </div>
    </LayoutShell>
  );
}
