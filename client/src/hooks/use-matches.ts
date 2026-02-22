import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { UpdateMatchScoreRequest } from "@shared/schema";
import { apiRequest } from "../lib/queryClient";

export function useUpdateMatchScore(tournamentId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & UpdateMatchScoreRequest) => {
      const url = buildUrl(api.matches.update.path, { id });

      const res = await apiRequest(api.matches.update.method, url, data);

      if (!res.ok) throw new Error("Failed to update match score");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [api.tournaments.get.path, tournamentId],
      });
      queryClient.invalidateQueries({ queryKey: [api.public.get.path] });
    },
  });
}