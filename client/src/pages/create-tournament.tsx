import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { LayoutShell } from "@/components/layout-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useCreateTournament } from "@/hooks/use-tournaments";
import { Loader2, Plus, Trash2, Trophy, Users, History, UserPlus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

export default function CreateTournament() {
  const [, setLocation] = useLocation();
  const { mutate: create, isPending } = useCreateTournament();
  const { toast } = useToast();

    const { data: leaguesList = [] } = useQuery<Array<{ id: number; name: string }>>({
      queryKey: ['/api/leagues'],
    });
    const [name, setName] = useState("");
    const [leagueId, setLeagueId] = useState<number | null>(null);
    const [type, setType] = useState("ROUND_ROBIN");
    const [players, setPlayers] = useState<string[]>(["", ""]);
    const [bulkInput, setBulkInput] = useState("");
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [isLegacy, setIsLegacy] = useState(false);
    const [eventDate, setEventDate] = useState("");
    const [legacyPlayerCount, setLegacyPlayerCount] = useState(8);
    const [randomize, setRandomize] = useState(true);
    const [collabEmails, setCollabEmails] = useState<string[]>([]);
    const [collabInput, setCollabInput] = useState("");
    const [groupCount, setGroupCount] = useState(1);
    const [groupBestOf, setGroupBestOf] = useState(3);
    const [knockoutBestOf, setKnockoutBestOf] = useState(5);
    const [r16BestOf, setR16BestOf] = useState(5);
    const [qfBestOf, setQfBestOf] = useState(5);
    const [sfBestOf, setSfBestOf] = useState(7);
    const [fBestOf, setFBestOf] = useState(9);
    const [seeded, setSeeded] = useState(true);
    const [pointsForWin, setPointsForWin] = useState(2);
    const [pointsForLoss, setPointsForLoss] = useState(0);
    const [numBoards, setNumBoards] = useState(1);
    const [useSets, setUseSets] = useState(false);
    const [groupScheduleMode, setGroupScheduleMode] = useState<'standard' | 'board_rotation'>('standard');
    const [groupNumBoards, setGroupNumBoards] = useState(2);
    const [enableThirdPlaceBracket, setEnableThirdPlaceBracket] = useState(false);
    const [tpQfBestOf, setTpQfBestOf] = useState(3);
    const [tpSfBestOf, setTpSfBestOf] = useState(5);
    const [tpFBestOf, setTpFBestOf] = useState(7);

    const koPlayerCount = (() => {
      if (type === "MULTI_STAGE") return groupCount * 2;
      if (isLegacy) return legacyPlayerCount;
      if (isBulkMode) return bulkInput.split('\n').filter(p => p.trim() !== '').length;
      return players.filter(p => p.trim() !== '').length;
    })();
    const koNextPow2 = (n: number) => { let p = 1; while (p < n) p *= 2; return p; };
    const koTotalSlots = koNextPow2(Math.max(koPlayerCount, 2));
    const showR16 = (type === "KNOCKOUT" || type === "MULTI_STAGE") && koTotalSlots >= 16;
    const showQF = type === "DOUBLE_ELIMINATION" || ((type === "KNOCKOUT" || type === "MULTI_STAGE") && koTotalSlots >= 8);
    const showSF = type === "DOUBLE_ELIMINATION" || ((type === "KNOCKOUT" || type === "MULTI_STAGE") && koTotalSlots >= 4);
    const showTpQF = groupCount >= 5;

    const handleAddPlayer = () => {
      if (players.length >= 48) return;
      setPlayers([...players, ""]);
    };
    
    const handleRemovePlayer = (index: number) => {
      if (players.length <= 2) return;
      setPlayers(players.filter((_, i) => i !== index));
    };

    const handlePlayerChange = (index: number, value: string) => {
      const newPlayers = [...players];
      newPlayers[index] = value;
      setPlayers(newPlayers);
    };

    const handleDateInput = (value: string) => {
      const digits = value.replace(/\D/g, '');
      let formatted = '';
      for (let i = 0; i < digits.length && i < 8; i++) {
        if (i === 2 || i === 4) formatted += '/';
        formatted += digits[i];
      }
      setEventDate(formatted);
    };

    const parseEventDate = (ddmmyyyy: string): string | null => {
      const parts = ddmmyyyy.split('/');
      if (parts.length !== 3) return null;
      const [dd, mm, yyyy] = parts;
      if (dd.length !== 2 || mm.length !== 2 || yyyy.length !== 4) return null;
      const day = parseInt(dd), month = parseInt(mm), year = parseInt(yyyy);
      if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
      if (month < 1 || month > 12 || day < 1 || year < 1900) return null;
      const daysInMonth = new Date(year, month, 0).getDate();
      if (day > daysInMonth) return null;
      return `${yyyy}-${mm}-${dd}`;
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();

      if (!eventDate || !parseEventDate(eventDate)) {
        toast({
          title: "Date required",
          description: "Please enter a valid tournament date in DD/MM/YYYY format.",
          variant: "destructive"
        });
        return;
      }

      let validPlayers: string[];

      if (isLegacy) {
        if (legacyPlayerCount < 2) {
          toast({
            title: "Not enough players",
            description: "You need at least 2 players.",
            variant: "destructive"
          });
          return;
        }
        validPlayers = Array.from({ length: legacyPlayerCount }, (_, i) => `Player ${i + 1}`);
      } else {
        let playerList = players;
        if (isBulkMode) {
          playerList = bulkInput.split("\n").map(p => p.trim()).filter(p => p !== "");
        }
        validPlayers = playerList.filter(p => p.trim() !== "");
        if (validPlayers.length < 2) {
          toast({
            title: "Not enough players",
            description: "You need at least 2 players to start a tournament.",
            variant: "destructive"
          });
          return;
        }
      }

      create({
        name,
        type,
        leagueId,
        playerNames: validPlayers,
        randomize,
        isLegacy,
        eventDate: parseEventDate(eventDate),
        settings: {
          groupCount: (type === "ROUND_ROBIN" || type === "MULTI_STAGE") ? groupCount : undefined,
          groupBestOf: (type === "ROUND_ROBIN" || type === "MULTI_STAGE") ? groupBestOf : undefined,
          knockoutBestOf: (type === "KNOCKOUT" || type === "DOUBLE_ELIMINATION") ? knockoutBestOf : undefined,
          knockoutBestOfByRound: (type === "KNOCKOUT" || type === "MULTI_STAGE") ? {
            ...(showR16 ? { lastSixteen: r16BestOf } : {}),
            ...(showQF ? { quarterFinal: qfBestOf } : {}),
            semiFinal: sfBestOf,
            final: fBestOf
          } : undefined,
          seeded: (type === "KNOCKOUT" || type === "MULTI_STAGE") ? seeded : undefined,
          numBoards: type === "KNOCKOUT" ? numBoards : undefined,
          useSets: type === "KNOCKOUT" ? useSets : undefined,
          pointsForWin: (type === "ROUND_ROBIN" || type === "MULTI_STAGE") ? pointsForWin : undefined,
          pointsForLoss: (type === "ROUND_ROBIN" || type === "MULTI_STAGE") ? pointsForLoss : undefined,
          groupScheduleMode: (type === "ROUND_ROBIN" || type === "MULTI_STAGE") && groupCount >= 4 ? groupScheduleMode : undefined,
          numberOfBoards: (type === "ROUND_ROBIN" || type === "MULTI_STAGE") && groupCount >= 4 && groupScheduleMode === 'board_rotation' ? groupNumBoards : undefined,
          enableThirdPlaceBracket: type === "MULTI_STAGE" && groupCount >= 4 && groupScheduleMode === 'board_rotation' && enableThirdPlaceBracket ? true : undefined,
          thirdPlaceBestOfByRound: type === "MULTI_STAGE" && groupCount >= 4 && groupScheduleMode === 'board_rotation' && enableThirdPlaceBracket ? {
            ...(showTpQF ? { quarterFinal: tpQfBestOf } : {}),
            semiFinal: tpSfBestOf,
            final: tpFBestOf,
          } : undefined,
        }
      }, {
        onSuccess: async (newTournament) => {
          if (collabEmails.length > 0) {
            for (const email of collabEmails) {
              try {
                await fetch(`/api/tournaments/${newTournament.id}/collaborators`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email }),
                });
              } catch {}
            }
          }
          toast({
            title: "Tournament Created",
            description: "Ready to play! Redirecting...",
          });
          setLocation("/tournaments");
        }
      });
    };

  return (
    <LayoutShell>
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Create New Tournament</h1>
          <p className="text-muted-foreground mt-1">Configure your tournament format and add players.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Info */}
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <Trophy className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold">Format & Details</h2>
              </div>
              
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="name">Tournament Name</Label>
                  <Input 
                    id="name" 
                    placeholder="e.g. Friday Night Darts" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="h-12 text-lg"
                  />
                </div>

                <div className="space-y-2 flex items-center justify-between border rounded-xl p-4 col-span-2" data-testid="toggle-legacy">
                  <div className="space-y-0.5">
                    <Label className="text-base flex items-center gap-2">
                      <History className="w-4 h-4" />
                      Legacy Tournament
                    </Label>
                    <p className="text-xs text-muted-foreground">For entering past tournament results manually. No live features.</p>
                  </div>
                  <Switch checked={isLegacy} onCheckedChange={setIsLegacy} />
                </div>

                <div className="space-y-2" data-testid="input-event-date-wrapper">
                  <Label htmlFor="eventDate">Tournament Date <span className="text-destructive">*</span></Label>
                  <Input
                    id="eventDate"
                    type="text"
                    inputMode="numeric"
                    placeholder="DD/MM/YYYY"
                    value={eventDate}
                    onChange={(e) => handleDateInput(e.target.value)}
                    maxLength={10}
                    className="h-12 text-lg"
                    data-testid="input-event-date"
                    required
                  />
                </div>

                {leaguesList.length > 0 && (
                  <div className="space-y-2">
                    <Label>League (optional)</Label>
                    <Select value={leagueId?.toString() ?? "none"} onValueChange={(val) => setLeagueId(val === "none" ? null : parseInt(val))}>
                      <SelectTrigger className="h-12" data-testid="select-league">
                        <SelectValue placeholder="No league" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No league</SelectItem>
                        {leaguesList.map(l => (
                          <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="type">Tournament Format</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ROUND_ROBIN">Round Robin</SelectItem>
                      <SelectItem value="KNOCKOUT">Knockout</SelectItem>
                      <SelectItem value="DOUBLE_ELIMINATION">Double Elimination</SelectItem>
                      <SelectItem value="MULTI_STAGE">Multi-Stage (Groups & Knockout)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {type === "ROUND_ROBIN" && "Every player plays every other player. Best for leagues."}
                    {type === "KNOCKOUT" && "Standard bracket. Loser goes home."}
                    {type === "DOUBLE_ELIMINATION" && "Two losses to be eliminated. Winners & Losers brackets."}
                    {type === "MULTI_STAGE" && "Players start in groups and advance to a knockout bracket."}
                  </p>
                </div>

                <div className="space-y-2 flex items-center justify-between border rounded-xl p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Randomize Seeds</Label>
                    <p className="text-xs text-muted-foreground">Shuffle player order before generating matches</p>
                  </div>
                  <Switch checked={randomize} onCheckedChange={setRandomize} />
                </div>

                {(type === "ROUND_ROBIN" || type === "MULTI_STAGE") && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="groupCount">Number of Groups</Label>
                      <Select 
                        value={groupCount.toString()} 
                        onValueChange={(val) => { setGroupCount(parseInt(val)); setGroupScheduleMode('standard'); }}
                      >
                        <SelectTrigger id="groupCount" className="h-12">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 4, 8].map(n => (
                            <SelectItem key={n} value={n.toString()}>{n} Group{n > 1 ? 's' : ''}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {groupCount >= 4 && (
                      <div className="space-y-2">
                        <Label htmlFor="groupScheduleMode">Board Schedule Mode</Label>
                        <Select
                          value={groupScheduleMode}
                          onValueChange={(val) => setGroupScheduleMode(val as 'standard' | 'board_rotation')}
                        >
                          <SelectTrigger id="groupScheduleMode" className="h-12" data-testid="select-group-schedule-mode">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="board_rotation">Board Rotation</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {type === "MULTI_STAGE" && groupCount >= 4 && groupScheduleMode === 'board_rotation' && (
                      <div className="flex items-center justify-between">
                        <Label htmlFor="enableThirdPlaceBracket" className="cursor-pointer">3rd Place Consolation Bracket</Label>
                        <Switch
                          id="enableThirdPlaceBracket"
                          checked={enableThirdPlaceBracket}
                          onCheckedChange={setEnableThirdPlaceBracket}
                          data-testid="toggle-third-place-bracket"
                        />
                      </div>
                    )}

                    {type === "MULTI_STAGE" && groupCount >= 4 && groupScheduleMode === 'board_rotation' && enableThirdPlaceBracket && (
                      <div className="space-y-3 border rounded-xl p-3 bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/40">
                        <Label className="text-sm font-semibold text-amber-800 dark:text-amber-300">3rd Place Bracket Formats</Label>
                        <div className={`grid gap-3 ${showTpQF ? "md:grid-cols-3" : "grid-cols-2"}`}>
                          {showTpQF && (
                            <div className="space-y-1.5">
                              <Label htmlFor="tpQfBestOf" className="text-xs text-muted-foreground">Quarter Finals</Label>
                              <Select value={tpQfBestOf.toString()} onValueChange={(v) => setTpQfBestOf(parseInt(v))}>
                                <SelectTrigger id="tpQfBestOf" className="h-9" data-testid="select-tp-qf-best-of">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {[1, 3, 5, 7, 9, 11].map(n => (
                                    <SelectItem key={n} value={n.toString()}>Best of {n}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <div className="space-y-1.5">
                            <Label htmlFor="tpSfBestOf" className="text-xs text-muted-foreground">Semi Finals</Label>
                            <Select value={tpSfBestOf.toString()} onValueChange={(v) => setTpSfBestOf(parseInt(v))}>
                              <SelectTrigger id="tpSfBestOf" className="h-9" data-testid="select-tp-sf-best-of">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[1, 3, 5, 7, 9, 11].map(n => (
                                  <SelectItem key={n} value={n.toString()}>Best of {n}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="tpFBestOf" className="text-xs text-muted-foreground">Final</Label>
                            <Select value={tpFBestOf.toString()} onValueChange={(v) => setTpFBestOf(parseInt(v))}>
                              <SelectTrigger id="tpFBestOf" className="h-9" data-testid="select-tp-f-best-of">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[1, 3, 5, 7, 9, 11].map(n => (
                                  <SelectItem key={n} value={n.toString()}>Best of {n}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    )}

                    {groupCount >= 4 && groupScheduleMode === 'board_rotation' && (
                      <div className="space-y-2">
                        <Label htmlFor="groupNumBoards">Number of Boards</Label>
                        <Select
                          value={groupNumBoards.toString()}
                          onValueChange={(val) => setGroupNumBoards(parseInt(val))}
                        >
                          <SelectTrigger id="groupNumBoards" className="h-12" data-testid="select-group-num-boards">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[2, 4, 6, 8].map(n => (
                              <SelectItem key={n} value={n.toString()}>{n} Board{n > 1 ? 's' : ''}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {groupCount / groupNumBoards !== 2 && (
                          <p className="text-sm text-muted-foreground">
                            For board rotation, the number of groups should be exactly twice the number of boards (currently {groupCount} groups ÷ {groupNumBoards} boards = {(groupCount / groupNumBoards).toFixed(1)}). Scheduling will fall back to standard if invalid.
                          </p>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="groupBestOf">Group Stage Match Format</Label>
                      <Select 
                        value={groupBestOf.toString()} 
                        onValueChange={(val) => setGroupBestOf(parseInt(val))}
                      >
                        <SelectTrigger id="groupBestOf" className="h-12">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 3, 5, 7, 9, 11].map(n => (
                            <SelectItem key={n} value={n.toString()}>Best of {n} legs</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {(type === "ROUND_ROBIN" || type === "MULTI_STAGE") && (
                  <div className="space-y-4 col-span-2 border rounded-xl p-4 bg-muted/30">
                    <Label className="text-base font-bold">Points System</Label>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="pointsWin">Points for Win</Label>
                        <Input
                          id="pointsWin"
                          type="number"
                          min={0}
                          max={10}
                          value={pointsForWin}
                          onChange={(e) => setPointsForWin(parseInt(e.target.value) || 0)}
                          className="h-10"
                          data-testid="input-points-win"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pointsLoss">Points for Loss</Label>
                        <Input
                          id="pointsLoss"
                          type="number"
                          min={0}
                          max={10}
                          value={pointsForLoss}
                          onChange={(e) => setPointsForLoss(parseInt(e.target.value) || 0)}
                          className="h-10"
                          data-testid="input-points-loss"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {(type === "KNOCKOUT" || type === "DOUBLE_ELIMINATION" || type === "MULTI_STAGE") && (
                  <div className="space-y-6 col-span-2 border rounded-xl p-4 bg-muted/30">
                    <Label className="text-base font-bold">Knockout Stage Formats</Label>
                    
                    <div className={`grid gap-4 ${showR16 ? "md:grid-cols-4" : showQF ? "md:grid-cols-3" : showSF ? "grid-cols-2" : "grid-cols-1"}`}>
                      {showR16 && (
                        <div className="space-y-2">
                          <Label htmlFor="r16BestOf">Last 16</Label>
                          <Select value={r16BestOf.toString()} onValueChange={(v) => setR16BestOf(parseInt(v))}>
                            <SelectTrigger id="r16BestOf" className="h-10">
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

                      {showQF && (
                        <div className="space-y-2">
                          <Label htmlFor="qfBestOf">Quarter Finals</Label>
                          <Select value={qfBestOf.toString()} onValueChange={(v) => setQfBestOf(parseInt(v))}>
                            <SelectTrigger id="qfBestOf" className="h-10">
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

                      {showSF && (
                        <div className="space-y-2">
                          <Label htmlFor="sfBestOf">Semi Finals</Label>
                          <Select value={sfBestOf.toString()} onValueChange={(v) => setSfBestOf(parseInt(v))}>
                            <SelectTrigger id="sfBestOf" className="h-10">
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

                      <div className="space-y-2">
                        <Label htmlFor="fBestOf">Grand Final</Label>
                        <Select value={fBestOf.toString()} onValueChange={(v) => setFBestOf(parseInt(v))}>
                          <SelectTrigger id="fBestOf" className="h-10">
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
                      <div className="space-y-2">
                        <Label htmlFor="knockoutBestOf">All Other Bracket Matches</Label>
                        <Select 
                          value={knockoutBestOf.toString()} 
                          onValueChange={(val) => setKnockoutBestOf(parseInt(val))}
                        >
                          <SelectTrigger id="knockoutBestOf" className="h-10">
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
                  </div>
                )}

                {(type === "KNOCKOUT" || type === "MULTI_STAGE") && (
                  <div className="space-y-2 flex items-center justify-between border rounded-xl p-4">
                    <div className="space-y-0.5">
                      <Label className="text-base">Seeded Bracket</Label>
                      <p className="text-xs text-muted-foreground">
                        {type === "MULTI_STAGE"
                          ? "Keep same-group qualifiers apart until final"
                          : "Highest seeds play lowest seeds in first round"}
                      </p>
                    </div>
                    <Switch checked={seeded} onCheckedChange={setSeeded} />
                  </div>
                )}

                {type === "KNOCKOUT" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="numBoards">Number of Boards</Label>
                      <Select value={numBoards.toString()} onValueChange={(v) => setNumBoards(parseInt(v))}>
                        <SelectTrigger id="numBoards" className="h-12" data-testid="select-num-boards">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 4, 8].map(n => (
                            <SelectItem key={n} value={n.toString()}>{n} {n === 1 ? 'Board' : 'Boards'}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">How many scorer tablets will be used simultaneously</p>
                    </div>

                    <div className="space-y-2 flex items-center justify-between border rounded-xl p-4">
                      <div className="space-y-0.5">
                        <Label className="text-base">Use Sets</Label>
                        <p className="text-xs text-muted-foreground">Play matches in sets (each set won by winning legs)</p>
                      </div>
                      <Switch checked={useSets} onCheckedChange={setUseSets} data-testid="toggle-use-sets" />
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Players */}
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <Users className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold">Players</h2>
                </div>
                {!isLegacy && (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="bulk-toggle" className="text-xs cursor-pointer">Bulk Mode</Label>
                      <Switch 
                        id="bulk-toggle"
                        checked={isBulkMode} 
                        onCheckedChange={(checked) => {
                          setIsBulkMode(checked);
                          if (checked) {
                            setBulkInput(players.filter(p => p.trim() !== "").join("\n"));
                          } else {
                            const newPlayers = bulkInput.split("\n").map(p => p.trim()).filter(p => p !== "");
                            setPlayers(newPlayers.length > 0 ? newPlayers : ["", ""]);
                          }
                        }} 
                      />
                    </div>
                    <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded-md">
                      {isBulkMode ? bulkInput.split("\n").filter(p => p.trim() !== "").length : players.length} Players
                    </span>
                  </div>
                )}
              </div>

              {isLegacy ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="legacyPlayerCount">Number of Players</Label>
                    <Input
                      id="legacyPlayerCount"
                      type="number"
                      min={2}
                      max={48}
                      value={legacyPlayerCount}
                      onChange={(e) => setLegacyPlayerCount(Math.max(2, Math.min(48, parseInt(e.target.value) || 2)))}
                      className="h-12 text-lg"
                      data-testid="input-legacy-player-count"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Players will be named Player 1, Player 2, etc. You can rename them after creating the tournament.
                  </p>
                </div>
              ) : isBulkMode ? (
                <div className="space-y-2">
                  <Label htmlFor="bulk-players">Player Names (one per line)</Label>
                  <Textarea
                    id="bulk-players"
                    placeholder="Enter names here..."
                    className="min-h-[200px] font-mono"
                    value={bulkInput}
                    onChange={(e) => setBulkInput(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Tip: Paste a list from Excel or a text file.</p>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    {players.map((player, idx) => (
                      <div key={idx} className="flex gap-2">
                        <div className="flex-none flex items-center justify-center w-8 h-10 bg-muted/50 rounded-md font-mono text-xs text-muted-foreground">
                          {idx + 1}
                        </div>
                        <Input
                          placeholder={`Player Name`}
                          value={player}
                          onChange={(e) => handlePlayerChange(idx, e.target.value)}
                          required={idx < 2}
                          className="flex-1"
                        />
                        {players.length > 2 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemovePlayer(idx)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleAddPlayer}
                    className="w-full border-dashed"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Player
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Collaborators */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Collaborators</h2>
                  <p className="text-sm text-muted-foreground">Optional — invite others to help run this tournament.</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">They need a TKO account. Collaborators can manage players, score matches, and use tablets.</p>
              {collabEmails.length > 0 && (
                <div className="space-y-2">
                  {collabEmails.map((email, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border/40">
                      <span className="text-sm">{email}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setCollabEmails(collabEmails.filter((_, i) => i !== idx))}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Enter TKO email address..."
                  value={collabInput}
                  onChange={(e) => setCollabInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const trimmed = collabInput.trim();
                      if (trimmed && !collabEmails.includes(trimmed)) {
                        setCollabEmails([...collabEmails, trimmed]);
                        setCollabInput("");
                      }
                    }
                  }}
                  className="flex-1"
                  data-testid="input-collab-email"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const trimmed = collabInput.trim();
                    if (trimmed && !collabEmails.includes(trimmed)) {
                      setCollabEmails([...collabEmails, trimmed]);
                      setCollabInput("");
                    }
                  }}
                  disabled={!collabInput.trim()}
                  data-testid="button-add-collab-email"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => setLocation("/tournaments")}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              size="lg" 
              disabled={isPending}
              className="min-w-[200px]"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Tournament
            </Button>
          </div>
        </form>
      </div>
    </LayoutShell>
  );
}
