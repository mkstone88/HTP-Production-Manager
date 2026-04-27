"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import type { Sub } from "@/lib/airtable/types";

async function fetchSubs(): Promise<Sub[]> {
  const res = await fetch("/api/subs", { cache: "no-store" });
  const data = (await res.json()) as { subs?: Sub[]; error?: string };
  if (!res.ok || !data.subs) throw new Error(data.error || "Failed to load subs");
  return data.subs;
}

export function SubsList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["subs"],
    queryFn: fetchSubs,
  });

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading subs…</div>;
  }
  if (error) {
    return (
      <div className="m-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load subs."}
      </div>
    );
  }
  if (!data || data.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No subcontractors yet. Add one to get started.
      </div>
    );
  }

  return (
    <ul className="divide-y">
      {data.map((s) => (
        <li key={s.id} className="px-4 py-3">
          <Link href={`/subs/${s.id}`} className="block">
            <div className="flex items-center justify-between">
              <div className="font-medium">{s.name}</div>
              <span
                className={
                  "rounded-full px-2 py-0.5 text-xs " +
                  (s.active === false
                    ? "bg-muted text-muted-foreground"
                    : "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200")
                }
              >
                {s.active === false ? "Inactive" : "Active"}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              {[s.trade, s.contactName, s.phone].filter(Boolean).join(" · ") || "—"}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
