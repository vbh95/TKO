import { useState } from "react";
import { useLocation } from "wouter";
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
import { Loader2, Plus, Trash2, Trophy, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

export default function CreateTournament() {
  const [, setLocation] = useLocation();
  const { mutate: create, isPending } = useCreateTournament();
  const { toast } = useToast();

    const [name, setName] = useState("");
    const [type, setType] = useState("ROUND_ROBIN");
    const [players, setPlayers] = useState<string[]>(["", ""]);
    const [bulkInput, setBulkInput] = useState("");
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [randomize, setRandomize] = useState(false);
    const [groupCount, setGroupCount] = useState(1);
    const [groupBestOf, setGroupBestOf] = useState(3);
    const [knockoutBestOf, setKnockoutBestOf] = useState(5);
    const [qfBestOf, setQfBestOf] = useState(5);
    const [sfBestOf, setSfBestOf] = useState(7);
    const [fBestOf, setFBestOf] = useState(9);
    const [seeded, setSeeded] = useState(false);
    const [pointsForWin, setPointsForWin] = useState(2);
    const [pointsForLoss, setPointsForLoss] = useState(0);

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

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      let playerList = players;
      if (isBulkMode) {
        playerList = bulkInput.split("\n").map(p => p.trim()).filter(p => p !== "");
      }

      const validPlayers = playerList.filter(p => p.trim() !== "");
      if (validPlayers.length < 2) {
        toast({
          title: "Not enough players",
          description: "You need at least 2 players to start a tournament.",
          variant: "destructive"
        });
        return;
      }

      create({
        name,
        type,
        playerNames: validPlayers,
        randomize,
        settings: {
          groupCount: (type === "ROUND_ROBIN" || type === "MULTI_STAGE") ? groupCount : undefined,
          groupBestOf: (type === "ROUND_ROBIN" || type === "MULTI_STAGE") ? groupBestOf : undefined,
          knockoutBestOf: (type === "KNOCKOUT" || type === "DOUBLE_ELIMINATION") ? knockoutBestOf : undefined,
          knockoutBestOfByRound: (type === "KNOCKOUT" || type === "MULTI_STAGE") ? {
            quarterFinal: qfBestOf,
            semiFinal: sfBestOf,
            final: fBestOf
          } : undefined,
          seeded: (type === "KNOCKOUT" || type === "MULTI_STAGE") ? seeded : undefined,
          pointsForWin: (type === "ROUND_ROBIN" || type === "MULTI_STAGE") ? pointsForWin : undefined,
          pointsForLoss: (type === "ROUND_ROBIN" || type === "MULTI_STAGE") ? pointsForLoss : undefined,
        }
      }, {
        onSuccess: () => {
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
                        onValueChange={(val) => setGroupCount(parseInt(val))}
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
                    
                    <div className="grid gap-4 md:grid-cols-3">
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
                      <p className="text-xs text-muted-foreground">Highest seeds play lowest seeds in first round</p>
                    </div>
                    <Switch checked={seeded} onCheckedChange={setSeeded} />
                  </div>
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
              </div>

              {isBulkMode ? (
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
                          required={idx < 2} // First two are required
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
