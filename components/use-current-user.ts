"use client";

import { useQuery } from "@tanstack/react-query";

import type { AppUser } from "@/lib/airtable/types";

/** The signed-in user, cached app-wide. `null` when not signed in. */
export function useCurrentUser() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async (): Promise<AppUser | null> => {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.status === 401) return null;
      const data = (await res.json()) as { user?: AppUser | null; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to load account");
      return data.user ?? null;
    },
    staleTime: 60_000,
  });
}
