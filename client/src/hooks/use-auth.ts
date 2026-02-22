import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type InsertUser } from "@shared/routes";
import { z } from "zod";
import { apiRequest } from "../lib/queryClient";

async function safeJson(res: Response) {
  // Avoid crashing if server returns empty body
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export function useUser() {
  return useQuery({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      const res = await apiRequest(api.auth.me.method, api.auth.me.path);

      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch user");

      return res.json();
    },
    retry: false,
    staleTime: Infinity,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials: z.infer<typeof api.auth.login.input>) => {
      const res = await apiRequest(api.auth.login.method, api.auth.login.path, credentials);

      if (!res.ok) {
        if (res.status === 401) throw new Error("Invalid email or password");
        throw new Error("Login failed");
      }

      return res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData([api.auth.me.path], user);
    },
  });
}

export function useSignup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InsertUser) => {
      const res = await apiRequest(api.auth.signup.method, api.auth.signup.path, data);

      if (!res.ok) {
        if (res.status === 400) {
          const error = await safeJson(res);
          throw new Error(error?.message || "Signup failed");
        }
        throw new Error("Signup failed");
      }

      return res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData([api.auth.me.path], user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest(api.auth.logout.method, api.auth.logout.path);

      if (!res.ok) throw new Error("Logout failed");
      return true;
    },
    onSuccess: () => {
      queryClient.setQueryData([api.auth.me.path], null);
      queryClient.invalidateQueries();
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name?: string;
      dateOfBirth?: string | null;
      phone?: string | null;
      billingAddress?: string | null;
    }) => {
      const res = await apiRequest(api.account.updateProfile.method, api.account.updateProfile.path, data);

      if (!res.ok) {
        const err = await safeJson(res);
        throw new Error(err?.message || "Update failed");
      }

      return res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData([api.auth.me.path], user);
    },
  });
}

export function useUpdateEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { email: string; currentPassword: string }) => {
      const res = await apiRequest(api.account.updateEmail.method, api.account.updateEmail.path, data);

      if (!res.ok) {
        const err = await safeJson(res);
        throw new Error(err?.message || "Update failed");
      }

      return res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData([api.auth.me.path], user);
    },
  });
}

export function useUpdatePassword() {
  return useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await apiRequest(api.account.updatePassword.method, api.account.updatePassword.path, data);

      if (!res.ok) {
        const err = await safeJson(res);
        throw new Error(err?.message || "Update failed");
      }

      return res.json();
    },
  });
}

export function useSetMemorableWord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { memorableWord: string; currentPassword: string }) => {
      const res = await apiRequest(api.account.setMemorableWord.method, api.account.setMemorableWord.path, data);

      if (!res.ok) {
        const err = await safeJson(res);
        throw new Error(err?.message || "Update failed");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
    },
  });
}