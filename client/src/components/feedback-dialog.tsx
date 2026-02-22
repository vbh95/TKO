import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquarePlus, Send, Loader2 } from "lucide-react";

export function FeedbackDialog() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [location] = useLocation();
  const { toast } = useToast();

  const submitFeedback = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/beta-feedback", {
        category,
        message,
        page: location,
      });
    },
    onSuccess: () => {
      toast({ title: "Feedback sent", description: "Thank you for helping us improve TKO!" });
      setCategory("");
      setMessage("");
      setOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to send", description: "Please try again.", variant: "destructive" });
    },
  });

  const isValid = category && message.trim().length >= 5;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="flex items-center gap-3 px-4 py-2.5 w-full rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200"
          data-testid="button-beta-feedback"
        >
          <MessageSquarePlus className="w-5 h-5" />
          Send Feedback
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="w-5 h-5 text-primary" />
            Beta Feedback
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Help us improve TKO! Report bugs, suggest features, or share your thoughts.
          </p>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger data-testid="select-feedback-category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">Bug Report</SelectItem>
                <SelectItem value="feature">Feature Request</SelectItem>
                <SelectItem value="usability">Usability Issue</SelectItem>
                <SelectItem value="general">General Feedback</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Your Feedback</Label>
            <Textarea
              placeholder="Describe the issue or suggestion..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              data-testid="textarea-feedback-message"
            />
          </div>
          <Button
            className="w-full gap-2"
            disabled={!isValid || submitFeedback.isPending}
            onClick={() => submitFeedback.mutate()}
            data-testid="button-submit-feedback"
          >
            {submitFeedback.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Submit Feedback
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
