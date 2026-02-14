import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { UpdateMatchScoreRequest } from "@shared/schema";

export function useUpdateMatchScore(tournamentId: number) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & UpdateMatchScoreRequest) => {
      const url = buildUrl(api.matches.update.path, { id });
      const res = await fetch(url, {
        method: api.matches.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) throw new Error("Failed to update match score");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [api.tournaments.get.path, tournamentId] 
      });
      queryClient.invalidateQueries({ queryKey: [api.public.get.path] });
    },
  });
}
