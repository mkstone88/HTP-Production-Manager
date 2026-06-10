"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { subColor } from "@/lib/sub-color";
import { cn } from "@/lib/utils";

import type { CapacityWeek } from "@/lib/schedule/capacity";

async function fetchCapacity(weeks: number): Promise<CapacityWeek[]> {
  const res = await fetch(`/api/capacity?weeks=${weeks}`, { cache: "no-store" });
  const data = (await res.json()) as { weeks?: CapacityWeek[]; error?: string };
  if (!res.ok || !data.weeks)
    throw new Error(data.error || "Failed to load capacity");
  return data.weeks;
}

function fmtWeek(startIso: string): string {
  const d = new Date(`${startIso}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtHours(h: number): string {
  return `${Math.round(h)}h`;
}

export function CapacityView() {
  const [weeks, setWeeks] = useState(6);
  const { data, isLoading, error } = useQuery({
    queryKey: ["capacity", weeks],
    queryFn: () => fetchCapacity(weeks),
  });

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 sm:gap-3 sm:px-4 sm:py-3">
        <Link href="/schedule">
          <Button variant="ghost" size="sm" className="h-10 px-2 sm:h-9">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">Crew capacity</h1>
        <select
          value={weeks}
          onChange={(e) => setWeeks(Number(e.target.value))}
          className="ml-auto h-10 rounded-md border border-input bg-background px-2 text-sm sm:h-9"
          aria-label="Weeks to show"
        >
          {[4, 6, 8, 12].map((n) => (
            <option key={n} value={n}>
              {n} weeks
            </option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div className="p-4 text-sm text-muted-foreground">Loading…</div>
      )}
      {error && (
        <div className="m-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load capacity"}
        </div>
      )}

      <div className="grid gap-4 p-3 sm:p-4 lg:grid-cols-2 xl:grid-cols-3">
        {(data ?? []).map((week) => {
          const pct =
            week.totalCapacity > 0
              ? Math.round((week.totalHours / week.totalCapacity) * 100)
              : 0;
          return (
            <section
              key={week.start}
              className="rounded-lg border bg-card p-4 shadow-sm"
            >
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className="font-semibold">
                  Week of {fmtWeek(week.start)}
                </h2>
                <span
                  className={cn(
                    "text-sm tabular-nums",
                    pct > 100
                      ? "font-semibold text-red-600 dark:text-red-400"
                      : pct >= 85
                        ? "font-medium text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground",
                  )}
                >
                  {fmtHours(week.totalHours)} / {fmtHours(week.totalCapacity)} ·{" "}
                  {pct}%
                </span>
              </div>

              <div className="space-y-2.5">
                {week.crews.map((crew) => {
                  const crewPct =
                    crew.capacityHours > 0
                      ? (crew.hours / crew.capacityHours) * 100
                      : 0;
                  return (
                    <div key={crew.subId}>
                      <div className="mb-0.5 flex items-center justify-between gap-2 text-sm">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span
                            aria-hidden
                            className="size-2.5 shrink-0 rounded-full"
                            style={{
                              backgroundColor: subColor({
                                subId: crew.subId,
                                override: crew.color,
                              }),
                            }}
                          />
                          <span className="truncate">{crew.subName}</span>
                        </span>
                        <span
                          className={cn(
                            "shrink-0 tabular-nums text-xs",
                            crewPct > 100
                              ? "font-semibold text-red-600 dark:text-red-400"
                              : "text-muted-foreground",
                          )}
                          title={crew.jobs.map((j) => `${j.name} (${fmtHours(j.hours)})`).join(", ")}
                        >
                          {fmtHours(crew.hours)} / {fmtHours(crew.capacityHours)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            crewPct > 100
                              ? "bg-red-500"
                              : crewPct >= 85
                                ? "bg-amber-500"
                                : "bg-emerald-500",
                          )}
                          style={{ width: `${Math.min(crewPct, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {week.unassignedHours > 0 && (
                  <div className="flex items-center justify-between gap-2 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                    <span>Unassigned work</span>
                    <span className="tabular-nums font-medium">
                      {fmtHours(week.unassignedHours)}
                    </span>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <p className="px-4 pb-6 text-xs text-muted-foreground">
        Hours come from each job&rsquo;s estimate, or 8h per scheduled day when
        no estimate exists. Set a crew&rsquo;s weekly capacity on their detail
        page (blank = 40h).
      </p>
    </div>
  );
}
