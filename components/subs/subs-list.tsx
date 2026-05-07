"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { Sub } from "@/lib/airtable/types";
import { subColor } from "@/lib/sub-color";
import { cn } from "@/lib/utils";

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

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Subcontractors</h1>
        <Link href="/subs/new" className="ml-auto" prefetch>
          <Button size="sm" className="h-10 px-3 sm:h-9">
            <Plus className="size-4" />
            New
          </Button>
        </Link>
      </div>

      {isLoading && (
        <div className="p-4 text-sm text-muted-foreground">Loading subs…</div>
      )}
      {error && (
        <div className="m-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load subs."}
        </div>
      )}
      {!isLoading && !error && (data?.length ?? 0) === 0 && (
        <div className="p-4 text-sm text-muted-foreground">
          No subcontractors yet. Add one to get started.
        </div>
      )}

      <ul className="divide-y">
        {(data ?? []).map((s) => (
          <li key={s.id}>
            <Link
              href={`/subs/${s.id}`}
              className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 active:bg-muted"
            >
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-full"
                style={{
                  backgroundColor: subColor({
                    subId: s.id,
                    override: s.color,
                  }),
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{s.name}</div>
                <div className="truncate text-sm text-muted-foreground">
                  {[s.contactName, s.phone].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              {s.status && (
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs",
                    statusColor(s.status),
                  )}
                >
                  {s.status}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function statusColor(s: string): string {
  switch (s) {
    case "Active":
      return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200";
    case "Onboarding":
      return "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200";
    case "Prospect":
      return "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200";
    case "Do Not Use!":
      return "bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200";
    default:
      return "bg-muted text-muted-foreground";
  }
}
