import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { UpdateMatchScoreRequest } from "@shared/schema";

export function useUpdateMatchScore() {
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
      return api.matches.update.responses[200].parse(await res.json());
    },
    onSuccess: async (match) => {
      await queryClient.invalidateQueries({ 
        queryKey: [api.tournaments.get.path, match.tournamentId] 
      });
      queryClient.invalidateQueries({ queryKey: [api.public.get.path] });
    },
  });
}
