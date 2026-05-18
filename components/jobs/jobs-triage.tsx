"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronDown,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { JobQuickEdit } from "@/components/jobs/job-quick-edit";
import type { Job, Sub } from "@/lib/airtable/types";
import { cn } from "@/lib/utils";

import type { TriageJob } from "@/app/api/jobs/triage/route";

async function fetchTriage(): Promise<TriageJob[]> {
  const res = await fetch("/api/jobs/triage", { cache: "no-store" });
  const data = (await res.json()) as { jobs?: TriageJob[]; error?: string };
  if (!res.ok || !data.jobs) throw new Error(data.error || "Failed to load triage");
  return data.jobs;
}

async function fetchSubs(): Promise<Sub[]> {
  const res = await fetch("/api/subs?activeOnly=true", { cache: "no-store" });
  const data = (await res.json()) as { subs?: Sub[]; error?: string };
  if (!res.ok || !data.subs) throw new Error(data.error || "Failed to load subs");
  return data.subs;
}

type JobPatch = Partial<{
  emailSent: boolean;
  customerReplied: boolean;
  colorsReceived: boolean;
  workOrderReady: boolean;
  assignedSubId: string | null;
}>;

async function patchJob(id: string, patch: JobPatch): Promise<Job> {
  const res = await fetch(`/api/jobs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = (await res.json()) as { job?: Job; error?: string };
  if (!res.ok || !data.job) throw new Error(data.error || "Update failed");
  return data.job;
}

export function JobsTriage() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);

  const triage = useQuery({ queryKey: ["jobs", "triage"], queryFn: fetchTriage });
  const subs = useQuery({ queryKey: ["subs", "active"], queryFn: fetchSubs });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: JobPatch }) =>
      patchJob(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ["jobs", "triage"] });
      const prev = qc.getQueryData<TriageJob[]>(["jobs", "triage"]);
      qc.setQueryData<TriageJob[]>(["jobs", "triage"], (old) =>
        (old ?? []).map((j) => {
          if (j.id !== id) return j;
          const next: TriageJob = {
            ...j,
            ...(patch.emailSent !== undefined && { emailSent: patch.emailSent }),
            ...(patch.customerReplied !== undefined && {
              customerReplied: patch.customerReplied,
            }),
            ...(patch.colorsReceived !== undefined && {
              colorsReceived: patch.colorsReceived,
            }),
            ...(patch.workOrderReady !== undefined && {
              workOrderReady: patch.workOrderReady,
            }),
            ...(patch.assignedSubId !== undefined && {
              assignedSubId: patch.assignedSubId ?? undefined,
            }),
            staging: {
              ...j.staging,
              emailSent: patch.emailSent ?? j.staging.emailSent,
              customerReplied:
                patch.customerReplied ?? j.staging.customerReplied,
              colorsReceived:
                patch.colorsReceived ?? j.staging.colorsReceived,
              workOrderReady:
                patch.workOrderReady ?? j.staging.workOrderReady,
              crewAssigned:
                patch.assignedSubId !== undefined
                  ? Boolean(patch.assignedSubId)
                  : j.staging.crewAssigned,
            },
          };
          return next;
        }),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["jobs", "triage"], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["jobs", "triage"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });

  if (triage.isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  }
  if (triage.error) {
    return (
      <div className="m-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        {triage.error instanceof Error ? triage.error.message : "Failed to load triage"}
      </div>
    );
  }
  if ((triage.data ?? []).length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No accepted projects waiting on staging. ✨
      </div>
    );
  }

  return (
    <>
      <ul className="divide-y">
        {(triage.data ?? []).map((j) => (
          <TriageRow
            key={j.id}
            job={j}
            subs={subs.data ?? []}
            onPatch={(patch) => update.mutate({ id: j.id, patch })}
            onOpenDetails={() => setEditingId(j.id)}
          />
        ))}
      </ul>
      <JobQuickEdit jobId={editingId} onClose={() => setEditingId(null)} />
    </>
  );
}

function TriageRow({
  job,
  subs,
  onPatch,
  onOpenDetails,
}: {
  job: TriageJob;
  subs: Sub[];
  onPatch: (patch: JobPatch) => void;
  onOpenDetails: () => void;
}) {
  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onOpenDetails}
          className="min-w-0 flex-1 text-left"
        >
          <div className="truncate font-medium">
            {job.name || job.customerName || "Job"}
          </div>
          <div className="truncate text-sm text-muted-foreground">
            {[job.customerName, job.address].filter(Boolean).join(" · ") || "—"}
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {job.staging.needsAttention && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
              title={
                job.staging.daysUntilStart !== undefined
                  ? `Starts in ${job.staging.daysUntilStart} day(s)`
                  : undefined
              }
            >
              <AlertTriangle className="size-3" />
              {job.staging.daysUntilStart !== undefined &&
              job.staging.daysUntilStart >= 0
                ? `${job.staging.daysUntilStart}d`
                : "Overdue"}
            </span>
          )}
          <span className="text-xs tabular-nums text-muted-foreground">
            {job.staging.done}/{job.staging.total}
          </span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <CheckPill
          label="Email"
          checked={job.staging.emailSent}
          onChange={(v) => onPatch({ emailSent: v })}
        />
        <CheckPill
          label="Reply"
          checked={job.staging.customerReplied}
          onChange={(v) => onPatch({ customerReplied: v })}
        />
        <CheckPill
          label="Colors"
          checked={job.staging.colorsReceived}
          onChange={(v) => onPatch({ colorsReceived: v })}
        />
        <CheckPill
          label="WO Ready"
          checked={job.staging.workOrderReady}
          onChange={(v) => onPatch({ workOrderReady: v })}
        />
        <CrewPill
          job={job}
          subs={subs}
          onAssign={(subId) => onPatch({ assignedSubId: subId })}
        />
        <SchedulePill job={job} />
      </div>
    </li>
  );
}

function CheckPill({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
        checked
          ? "border-emerald-600/50 bg-emerald-50 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100"
          : "border-input bg-background text-muted-foreground hover:bg-muted/40",
      )}
    >
      <span
        className={cn(
          "inline-flex size-4 items-center justify-center rounded-full border",
          checked ? "border-emerald-600 bg-emerald-600" : "border-input",
        )}
      >
        {checked && <Check className="size-3 text-white" strokeWidth={3} />}
      </span>
      <span>{label}</span>
    </button>
  );
}

function CrewPill({
  job,
  subs,
  onAssign,
}: {
  job: TriageJob;
  subs: Sub[];
  onAssign: (subId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (job.assignedSubId) {
    const sub = subs.find((s) => s.id === job.assignedSubId);
    return (
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-emerald-600/50 bg-emerald-50 px-2.5 text-xs text-emerald-900 transition-colors hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-100"
        >
          <span className="inline-flex size-4 items-center justify-center rounded-full border border-emerald-600 bg-emerald-600">
            <Check className="size-3 text-white" strokeWidth={3} />
          </span>
          <span className="max-w-[8rem] truncate">{sub?.name ?? "Crew"}</span>
          <ChevronDown className="size-3" />
        </button>
        {open && (
          <CrewMenu
            subs={subs}
            currentId={job.assignedSubId}
            onPick={(id) => {
              setOpen(false);
              onAssign(id);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-input bg-background px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40"
      >
        <Plus className="size-3.5" />
        <span>Crew</span>
      </button>
      {open && (
        <CrewMenu
          subs={subs}
          currentId={undefined}
          onPick={(id) => {
            setOpen(false);
            onAssign(id);
          }}
        />
      )}
    </div>
  );
}

function CrewMenu({
  subs,
  currentId,
  onPick,
}: {
  subs: Sub[];
  currentId?: string;
  onPick: (id: string | null) => void;
}) {
  return (
    <div className="absolute left-0 top-full z-30 mt-1 max-h-64 w-56 overflow-auto rounded-md border bg-background shadow-md">
      {currentId && (
        <button
          type="button"
          onClick={() => onPick(null)}
          className="block w-full px-3 py-2 text-left text-sm text-destructive hover:bg-muted/40"
        >
          Unassign
        </button>
      )}
      {subs.length === 0 ? (
        <div className="px-3 py-2 text-sm text-muted-foreground">
          No active subs.
        </div>
      ) : (
        subs.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s.id)}
            className={cn(
              "block w-full px-3 py-2 text-left text-sm hover:bg-muted/40",
              s.id === currentId && "bg-muted/60",
            )}
          >
            {s.name}
          </button>
        ))
      )}
    </div>
  );
}

function SchedulePill({ job }: { job: TriageJob }) {
  if (job.scheduledStart) {
    return (
      <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-emerald-600/50 bg-emerald-50 px-2.5 text-xs text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100">
        <span className="inline-flex size-4 items-center justify-center rounded-full border border-emerald-600 bg-emerald-600">
          <Check className="size-3 text-white" strokeWidth={3} />
        </span>
        <Calendar className="size-3" />
        <span className="tabular-nums">
          {job.scheduledStart}
          {job.scheduledEnd && job.scheduledEnd !== job.scheduledStart
            ? ` → ${job.scheduledEnd}`
            : ""}
        </span>
      </span>
    );
  }
  return (
    <Link
      href={`/schedule?focus=${job.id}`}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-input bg-background px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40"
    >
      <Plus className="size-3.5" />
      <span>Schedule</span>
    </Link>
  );
}
