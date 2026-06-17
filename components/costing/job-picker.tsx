"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import type { Job } from "@/lib/airtable/types";
import { cn } from "@/lib/utils";

/**
 * Pick a job to match an invoice to. With no search text it shows the most
 * recently completed jobs (the common case — invoices arrive right after a job
 * wraps); typing searches across all jobs by name / customer / address. The PO#
 * on an invoice is the job's street address, so `poHint` is surfaced to help.
 */
export function JobPicker({
  jobs,
  value,
  onSelect,
  poHint,
  recentLimit = 10,
}: {
  jobs: Job[];
  value?: string;
  onSelect: (jobId: string | null) => void;
  poHint?: string;
  recentLimit?: number;
}) {
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => jobs.find((j) => j.id === value),
    [jobs, value],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return [...jobs]
        .filter((j) => j.status === "Completed")
        .sort((a, b) => (b.scheduledEnd ?? "").localeCompare(a.scheduledEnd ?? ""))
        .slice(0, recentLimit);
    }
    return jobs
      .filter((j) =>
        [j.name, j.customerName, j.address, j.jobNumber]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q)),
      )
      .slice(0, 25);
  }, [jobs, query, recentLimit]);

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 p-3">
        <div className="min-w-0">
          <div className="truncate font-medium">
            {selected.name || selected.customerName || "Job"}
          </div>
          <div className="truncate text-sm text-muted-foreground">
            {[selected.customerName, selected.address].filter(Boolean).join(" · ") || "—"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-muted"
          aria-label="Clear selection"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {poHint && (
        <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
          <span className="text-muted-foreground">PO# (job address): </span>
          <span className="font-medium">{poHint}</span>
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search jobs by name or address…"
          className="pl-9"
        />
      </div>
      {!query && (
        <div className="px-1 text-xs text-muted-foreground">
          Recently completed jobs
        </div>
      )}
      <ul className="max-h-64 divide-y overflow-y-auto rounded-md border">
        {results.length === 0 && (
          <li className="p-3 text-sm text-muted-foreground">No matching jobs.</li>
        )}
        {results.map((j) => (
          <li key={j.id}>
            <button
              type="button"
              onClick={() => onSelect(j.id)}
              className={cn(
                "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors",
                "hover:bg-muted/60 active:bg-muted",
              )}
            >
              <span className="font-medium">{j.name || j.customerName || "Job"}</span>
              <span className="text-sm text-muted-foreground">
                {[j.customerName, j.address].filter(Boolean).join(" · ") || "—"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
