"use client";

import { useQuery } from "@tanstack/react-query";

import type { Job } from "@/lib/airtable/types";

async function fetchJobs(): Promise<Job[]> {
  const res = await fetch("/api/jobs", { cache: "no-store" });
  const data = (await res.json()) as { jobs?: Job[]; error?: string };
  if (!res.ok || !data.jobs) throw new Error(data.error || "Failed to load jobs");
  return data.jobs;
}

export function JobsList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["jobs"],
    queryFn: fetchJobs,
  });

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading jobs…</div>;
  }
  if (error) {
    return (
      <div className="m-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load jobs."}
      </div>
    );
  }
  if (!data || data.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">No jobs yet.</div>;
  }

  return (
    <ul className="divide-y">
      {data.map((j) => (
        <li key={j.id} className="px-4 py-3">
          <div className="font-medium">{j.name}</div>
          <div className="text-sm text-muted-foreground">
            {[j.client, j.address].filter(Boolean).join(" · ") || "—"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {j.scheduledStart
              ? `Scheduled: ${new Date(j.scheduledStart).toLocaleString()}`
              : "Unscheduled"}
            {j.status ? ` · ${j.status}` : ""}
          </div>
        </li>
      ))}
    </ul>
  );
}
