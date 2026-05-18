"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PauseCircle, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { JobQuickEdit } from "@/components/jobs/job-quick-edit";
import { JobsTriage } from "@/components/jobs/jobs-triage";
import { Button } from "@/components/ui/button";
import type { Job, Sub } from "@/lib/airtable/types";
import { cn } from "@/lib/utils";

type Tab = "triage" | "active" | "completed" | "all";

async function fetchJobs(): Promise<Job[]> {
  const res = await fetch("/api/jobs", { cache: "no-store" });
  const data = (await res.json()) as { jobs?: Job[]; error?: string };
  if (!res.ok || !data.jobs) throw new Error(data.error || "Failed to load jobs");
  return data.jobs;
}

async function fetchSubs(): Promise<Sub[]> {
  const res = await fetch("/api/subs", { cache: "no-store" });
  const data = (await res.json()) as { subs?: Sub[]; error?: string };
  if (!res.ok || !data.subs) throw new Error(data.error || "Failed to load subs");
  return data.subs;
}

function sortByStart(a: Job, b: Job): number {
  const ad = a.scheduledStart ?? "";
  const bd = b.scheduledStart ?? "";
  if (ad && bd) return ad.localeCompare(bd);
  if (ad) return -1;
  if (bd) return 1;
  return a.name.localeCompare(b.name);
}

export function JobsList() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("triage");
  const [editingId, setEditingId] = useState<string | null>(null);

  const jobs = useQuery({ queryKey: ["jobs"], queryFn: fetchJobs });
  const subs = useQuery({ queryKey: ["subs"], queryFn: fetchSubs });

  const subsById = useMemo(() => {
    const m = new Map<string, Sub>();
    for (const s of subs.data ?? []) m.set(s.id, s);
    return m;
  }, [subs.data]);

  const assignableSubs = useMemo(
    () =>
      (subs.data ?? []).filter(
        (s) => s.status === "Active" || s.status === "Onboarding",
      ),
    [subs.data],
  );

  /**
   * Active tab splits into two groups: real active work and parked (On Hold).
   * Other tabs use a single flat list.
   */
  const groups = useMemo(() => {
    const all = jobs.data ?? [];
    if (tab === "completed") {
      return {
        primary: all.filter((j) => j.status === "Completed").sort(sortByStart),
        onHold: [] as Job[],
      };
    }
    if (tab === "all") {
      return { primary: [...all].sort(sortByStart), onHold: [] as Job[] };
    }
    return {
      primary: all
        .filter((j) => j.status !== "Completed" && j.status !== "On Hold")
        .sort(sortByStart),
      onHold: all.filter((j) => j.status === "On Hold").sort(sortByStart),
    };
  }, [jobs.data, tab]);

  const reassign = useMutation({
    mutationFn: ({ id, subId }: { id: string; subId: string | null }) =>
      fetch(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedSubId: subId }),
      }).then(async (res) => {
        const data = (await res.json()) as { job?: Job; error?: string };
        if (!res.ok || !data.job) throw new Error(data.error || "Update failed");
        return data.job;
      }),
    onMutate: async ({ id, subId }) => {
      await qc.cancelQueries({ queryKey: ["jobs"] });
      const prev = qc.getQueryData<Job[]>(["jobs"]);
      qc.setQueryData<Job[]>(["jobs"], (old) =>
        (old ?? []).map((j) =>
          j.id === id ? { ...j, assignedSubId: subId ?? undefined } : j,
        ),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["jobs"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });

  const counts = useMemo(() => {
    const all = jobs.data ?? [];
    return {
      triage: all.filter((j) => j.status === "Proposal Accepted").length,
      active: all.filter((j) => j.status !== "Completed").length,
      completed: all.filter((j) => j.status === "Completed").length,
      all: all.length,
    };
  }, [jobs.data]);

  const totalShown = groups.primary.length + groups.onHold.length;
  const emptyState =
    !jobs.isLoading && !jobs.error && totalShown === 0
      ? tab === "active"
        ? "No active jobs. 🎉"
        : tab === "completed"
          ? "No completed jobs yet."
          : "No jobs yet."
      : null;

  const renderRow = (j: Job, dimmed: boolean) => (
    <JobRow
      key={j.id}
      job={j}
      dimmed={dimmed}
      assignableSubs={assignableSubs}
      subsById={subsById}
      onOpen={(id) => setEditingId(id)}
      onReassign={(id, subId) => reassign.mutate({ id, subId })}
    />
  );

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Jobs</h1>
        <Link href="/jobs/new" className="ml-auto" prefetch>
          <Button size="sm" className="h-10 px-3 sm:h-9">
            <Plus className="size-4" />
            New job
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Job filter"
        className="flex gap-1 border-b px-2 py-2 sm:px-3"
      >
        <TabButton active={tab === "triage"} onClick={() => setTab("triage")}>
          Triage <Count n={counts.triage} />
        </TabButton>
        <TabButton active={tab === "active"} onClick={() => setTab("active")}>
          Active <Count n={counts.active} />
        </TabButton>
        <TabButton
          active={tab === "completed"}
          onClick={() => setTab("completed")}
        >
          Completed <Count n={counts.completed} />
        </TabButton>
        <TabButton active={tab === "all"} onClick={() => setTab("all")}>
          All <Count n={counts.all} />
        </TabButton>
      </div>

      {tab === "triage" && <JobsTriage />}

      {tab !== "triage" && jobs.isLoading && (
        <div className="p-4 text-sm text-muted-foreground">Loading jobs…</div>
      )}
      {tab !== "triage" && jobs.error && (
        <div className="m-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {jobs.error instanceof Error ? jobs.error.message : "Failed to load jobs."}
        </div>
      )}
      {tab !== "triage" && emptyState && (
        <div className="p-4 text-sm text-muted-foreground">{emptyState}</div>
      )}

      {tab !== "triage" && (
      <ul className="divide-y">
        {groups.primary.map((j) => renderRow(j, j.status === "Completed"))}
      </ul>
      )}

      {tab !== "triage" && groups.onHold.length > 0 && (
        <>
          <div className="flex items-center gap-2 border-y bg-muted/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <PauseCircle className="size-4" />
            On Hold
            <span className="ml-1 font-normal opacity-70">
              ({groups.onHold.length})
            </span>
          </div>
          <ul className="divide-y">
            {groups.onHold.map((j) => renderRow(j, true))}
          </ul>
        </>
      )}

      <JobQuickEdit jobId={editingId} onClose={() => setEditingId(null)} />
    </div>
  );
}

function JobRow({
  job,
  dimmed,
  assignableSubs,
  subsById,
  onOpen,
  onReassign,
}: {
  job: Job;
  dimmed: boolean;
  assignableSubs: Sub[];
  subsById: Map<string, Sub>;
  onOpen: (id: string) => void;
  onReassign: (id: string, subId: string | null) => void;
}) {
  const j = job;
  return (
    <li className={cn(dimmed && "opacity-60")}>
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={() => onOpen(j.id)}
          className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 active:bg-muted"
        >
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">
              {j.name || j.customerName || "Job"}
            </div>
            <div className="truncate text-sm text-muted-foreground">
              {[j.customerName, j.address].filter(Boolean).join(" · ") || "—"}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>
                {j.scheduledStart
                  ? `${j.scheduledStart}${
                      j.scheduledEnd && j.scheduledEnd !== j.scheduledStart
                        ? ` → ${j.scheduledEnd}`
                        : ""
                    }`
                  : "Unscheduled"}
              </span>
              {j.status && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5",
                    statusColor(j.status),
                  )}
                >
                  {j.status}
                </span>
              )}
            </div>
          </div>
        </button>

        {/* Inline crew picker */}
        <div className="flex w-40 shrink-0 items-center justify-end pr-3 sm:w-56 sm:pr-4">
          <select
            value={j.assignedSubId ?? ""}
            onChange={(e) => onReassign(j.id, e.target.value || null)}
            onClick={(e) => e.stopPropagation()}
            aria-label="Crew leader"
            className={cn(
              "h-10 w-full max-w-[14rem] rounded-md border border-input bg-background px-2 text-sm",
              "transition-colors",
              !j.assignedSubId && "text-muted-foreground",
            )}
          >
            <option value="">Unassigned</option>
            {assignableSubs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            {j.assignedSubId &&
              !assignableSubs.find((s) => s.id === j.assignedSubId) &&
              subsById.get(j.assignedSubId) && (
                <option value={j.assignedSubId}>
                  {subsById.get(j.assignedSubId)?.name} (inactive)
                </option>
              )}
          </select>
        </div>
      </div>
    </li>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "h-10 rounded-md px-3 text-sm font-medium transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted/60",
      )}
    >
      {children}
    </button>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="ml-1 text-xs font-normal opacity-70">({n})</span>
  );
}

function statusColor(s: string): string {
  switch (s) {
    case "Completed":
      return "bg-muted text-muted-foreground";
    case "In Progress":
      return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200";
    case "Scheduled":
      return "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200";
    case "On Hold":
      return "bg-slate-200 text-slate-700 dark:bg-slate-700/40 dark:text-slate-200";
    default:
      return "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200";
  }
}
