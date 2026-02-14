import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useUpdateMatchScore } from "@/hooks/use-matches";
import { ChevronUp, ChevronDown, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Match, Player } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface MatchScoreInputProps {
  match: Match;
  playerA: Player | null;
  playerB: Player | null;
  isOpen: boolean;
  onClose: () => void;
  readOnly?: boolean;
}

export function MatchScoreInput({ match, playerA, playerB, isOpen, onClose, readOnly }: MatchScoreInputProps) {
  const { mutate: updateScore, isPending } = useUpdateMatchScore();
  const { toast } = useToast();
  
  const [scoreA, setScoreA] = useState(match.scoreA || 0);
  const [scoreB, setScoreB] = useState(match.scoreB || 0);
  const [highestCheckout, setHighestCheckout] = useState<string>("");
  const [numberOf180s, setNumberOf180s] = useState<string>("");

  const handleSave = () => {
    updateScore({
      id: match.id,
      scoreA,
      scoreB,
      notes: {
        highestCheckout: highestCheckout ? parseInt(highestCheckout) : undefined,
        numberOf180s: numberOf180s ? parseInt(numberOf180s) : undefined
      }
    }, {
      onSuccess: () => {
        toast({
          title: "Score updated",
          description: "Match results have been saved successfully.",
        });
        onClose();
      }
    });
  };

  const increment = (setter: React.Dispatch<React.SetStateAction<number>>, current: number) => {
    setter(current + 1);
  };

  const decrement = (setter: React.Dispatch<React.SetStateAction<number>>, current: number) => {
    if (current > 0) setter(current - 1);
  };

  const isWinnerA = scoreA > scoreB && scoreA > (match.bestOf / 2);
  const isWinnerB = scoreB > scoreA && scoreB > (match.bestOf / 2);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center font-display text-xl">
            Match Result
          </DialogTitle>
          <DialogDescription className="text-center">
            {match.roundKey} • Best of {match.bestOf}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 items-center py-6">
          {/* Player A Control */}
          <div className="flex flex-col items-center gap-3">
            <h3 className={cn("font-bold text-center", isWinnerA ? "text-primary" : "text-foreground")}>
              {playerA?.name || "TBD"}
            </h3>
            {isWinnerA && <Trophy className="w-4 h-4 text-yellow-500 animate-bounce" />}
            
            {!readOnly && (
              <div className="flex flex-col gap-2">
                <Button variant="outline" size="icon" onClick={() => increment(setScoreA, scoreA)}>
                  <ChevronUp className="w-4 h-4" />
                </Button>
                <div className="text-3xl font-display font-bold w-12 text-center">{scoreA}</div>
                <Button variant="outline" size="icon" onClick={() => decrement(setScoreA, scoreA)}>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </div>
            )}
            {readOnly && <div className="text-4xl font-display font-bold">{scoreA}</div>}
          </div>

          <div className="text-center text-muted-foreground font-display text-2xl font-light">
            VS
          </div>

          {/* Player B Control */}
          <div className="flex flex-col items-center gap-3">
            <h3 className={cn("font-bold text-center", isWinnerB ? "text-primary" : "text-foreground")}>
              {playerB?.name || "TBD"}
            </h3>
            {isWinnerB && <Trophy className="w-4 h-4 text-yellow-500 animate-bounce" />}
            
            {!readOnly && (
              <div className="flex flex-col gap-2">
                <Button variant="outline" size="icon" onClick={() => increment(setScoreB, scoreB)}>
                  <ChevronUp className="w-4 h-4" />
                </Button>
                <div className="text-3xl font-display font-bold w-12 text-center">{scoreB}</div>
                <Button variant="outline" size="icon" onClick={() => decrement(setScoreB, scoreB)}>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </div>
            )}
            {readOnly && <div className="text-4xl font-display font-bold">{scoreB}</div>}
          </div>
        </div>

        {/* Stats Input */}
        {!readOnly && (
          <div className="space-y-4 pt-4 border-t">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="checkout">Highest Checkout</Label>
                <Input 
                  id="checkout" 
                  type="number" 
                  placeholder="e.g. 170"
                  value={highestCheckout}
                  onChange={(e) => setHighestCheckout(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="180s">180s Scored</Label>
                <Input 
                  id="180s" 
                  type="number" 
                  placeholder="e.g. 3"
                  value={numberOf180s}
                  onChange={(e) => setNumberOf180s(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {!readOnly && (
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving..." : "Save Result"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
