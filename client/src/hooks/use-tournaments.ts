import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { InsertTournament, CreateTournamentRequest } from "@shared/schema";

// Get list of tournaments
export function useTournaments() {
  return useQuery({
    queryKey: [api.tournaments.list.path],
    queryFn: async () => {
      const res = await fetch(api.tournaments.list.path);
      if (!res.ok) throw new Error("Failed to fetch tournaments");
      return api.tournaments.list.responses[200].parse(await res.json());
    },
  });
}

// Get single tournament details
export function useTournament(id: number) {
  return useQuery({
    queryKey: [api.tournaments.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.tournaments.get.path, { id });
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch tournament");
      return api.tournaments.get.responses[200].parse(await res.json());
    },
  });
}

// Create new tournament
export function useCreateTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateTournamentRequest) => {
      const res = await fetch(api.tournaments.create.path, {
        method: api.tournaments.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) throw new Error("Failed to create tournament");
      return api.tournaments.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tournaments.list.path] });
    },
  });
}

// Update tournament details
export function useUpdateTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<InsertTournament>) => {
      const url = buildUrl(api.tournaments.update.path, { id });
      const res = await fetch(url, {
        method: api.tournaments.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) throw new Error("Failed to update tournament");
      return api.tournaments.update.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.tournaments.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.tournaments.get.path, data.id] });
    },
  });
}

// Delete tournament
export function useDeleteTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.tournaments.delete.path, { id });
      const res = await fetch(url, { method: api.tournaments.delete.method });
      if (!res.ok) throw new Error("Failed to delete tournament");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tournaments.list.path] });
    },
  });
}

// Bulk update players
export function useBulkUpdatePlayers(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ players, replace }: { players: { name: string, seed?: number }[], replace: boolean }) => {
      const url = buildUrl(api.tournaments.bulkPlayers.path, { id });
      const res = await fetch(url, {
        method: api.tournaments.bulkPlayers.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ players, replace }),
      });
      if (!res.ok) throw new Error("Failed to bulk update players");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tournaments.get.path, id] });
    },
  });
}

// Share functions
export function useTournamentShare(id: number) {
  const queryClient = useQueryClient();
  
  const enableShare = useMutation({
    mutationFn: async () => {
      const url = buildUrl(api.tournaments.share.enable.path, { id });
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) throw new Error("Failed to enable sharing");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tournaments.get.path, id] });
    },
  });

  const disableShare = useMutation({
    mutationFn: async () => {
      const url = buildUrl(api.tournaments.share.disable.path, { id });
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) throw new Error("Failed to disable sharing");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tournaments.get.path, id] });
    },
  });

  return { enableShare, disableShare };
}

// Public View Hook
export function usePublicTournament(token: string) {
  return useQuery({
    queryKey: [api.public.get.path, token],
    queryFn: async () => {
      const url = buildUrl(api.public.get.path, { shareToken: token });
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch tournament");
      return api.public.get.responses[200].parse(await res.json());
    },
    refetchInterval: 10000,
  });
}
