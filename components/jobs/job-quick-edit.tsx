"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { JobStatus, type Job, type Sub } from "@/lib/airtable/types";
import { cn } from "@/lib/utils";

const statuses = JobStatus.options;

async function fetchJob(id: string): Promise<Job> {
  const res = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
  const data = (await res.json()) as { job?: Job; error?: string };
  if (!res.ok || !data.job) throw new Error(data.error || "Failed to load job");
  return data.job;
}

async function fetchSubs(): Promise<Sub[]> {
  const res = await fetch("/api/subs", { cache: "no-store" });
  const data = (await res.json()) as { subs?: Sub[]; error?: string };
  if (!res.ok || !data.subs) throw new Error(data.error || "Failed to load subs");
  return data.subs;
}

/**
 * Patch payload accepts `null` for clearable fields (linked records, dates, status)
 * so we can send "unassign" / "no date" instead of leaving the value untouched.
 * The API route validates with zod; this just keeps the client honest.
 */
type JobPatchPayload = Partial<{
  status: string | null;
  assignedSubId: string | null;
  notes: string | null;
}>;

async function patchJob(id: string, patch: JobPatchPayload): Promise<Job> {
  const res = await fetch(`/api/jobs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = (await res.json()) as { job?: Job; error?: string };
  if (!res.ok || !data.job) throw new Error(data.error || "Failed to update job");
  return data.job;
}

type Props = {
  jobId: string | null;
  onClose: () => void;
};

export function JobQuickEdit({ jobId, onClose }: Props) {
  const open = jobId !== null;

  const job = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => fetchJob(jobId as string),
    enabled: open,
  });
  const subsQuery = useQuery({
    queryKey: ["subs"],
    queryFn: fetchSubs,
    enabled: open,
    staleTime: 60_000,
  });
  const subs = subsQuery.data ?? [];

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  const id = jobId as string;
  const j = job.data;
  const activeSubs = subs.filter(
    (s) => s.status === "Active" || s.status === "Onboarding",
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 animate-in fade-in bg-black/40 duration-200"
      />
      {/* Sheet / dialog */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative w-full max-w-md overflow-hidden bg-card shadow-xl",
          "rounded-t-2xl sm:rounded-2xl",
          "animate-in slide-in-from-bottom duration-200 sm:slide-in-from-bottom-0 sm:zoom-in-95",
          "max-h-[85dvh]",
        )}
      >
        {/* Drag handle (mobile only) */}
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-muted sm:hidden" />

        <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {j?.jobNumber || "—"}
            </div>
            <h2 className="truncate text-base font-semibold sm:text-lg">
              {j?.name || j?.customerName || (job.isLoading ? "Loading…" : "Job")}
            </h2>
            {(j?.customerName || j?.address) && (
              <div className="truncate text-xs text-muted-foreground">
                {[j?.customerName, j?.address].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-9 w-9 shrink-0 p-0"
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="space-y-4 overflow-y-auto px-4 py-4">
          {job.isLoading && (
            <div className="text-sm text-muted-foreground">Loading…</div>
          )}
          {job.error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {job.error instanceof Error ? job.error.message : "Failed to load"}
            </div>
          )}

          {j && (
            // Keyed so drafts reset when the sheet is reused for another job.
            <QuickEditForm key={id} id={id} job={j} activeSubs={activeSubs} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Edits live in a draft holding ONLY the fields the user has touched;
 * untouched fields track the server. The old version re-seeded all local
 * state from every refetch, which discarded characters typed while the
 * debounced notes save's invalidation round-trip was in flight.
 */
function QuickEditForm({
  id,
  job,
  activeSubs,
  onClose,
}: {
  id: string;
  job: Job;
  activeSubs: Sub[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<{
    status?: string;
    assignedSubId?: string;
    notes?: string;
  }>({});
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: ({ patch }: { patch: JobPatchPayload }) => patchJob(id, patch),
    onSuccess: (saved, vars) => {
      // Seed the cache with the response first so clearing the draft can't
      // flash the pre-save value, then drop draft keys whose value is what we
      // just saved — keeping anything the user typed since the request left.
      qc.setQueryData(["job", id], saved);
      qc.invalidateQueries({ queryKey: ["jobs"] });
      setDraft((d) => {
        const next = { ...d };
        for (const key of Object.keys(vars.patch) as (keyof JobPatchPayload)[]) {
          if (next[key] !== undefined && (next[key] || null) === vars.patch[key]) {
            delete next[key];
          }
        }
        return next;
      });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1200);
      setError(null);
    },
    onError: (e, vars) => {
      setError(e instanceof Error ? e.message : "Save failed");
      // Selects save on change: drop the failed value so they fall back to
      // the server state instead of showing a value that didn't stick. Notes
      // keep the local text — never discard typing.
      setDraft((d) => {
        const next = { ...d };
        if (vars.patch.status !== undefined) delete next.status;
        if (vars.patch.assignedSubId !== undefined) delete next.assignedSubId;
        return next;
      });
    },
  });

  const status = draft.status ?? job.status ?? "";
  const assignedSubId = draft.assignedSubId ?? job.assignedSubId ?? "";
  const notes = draft.notes ?? job.notes ?? "";

  // The timer deliberately keeps running if the sheet closes mid-debounce —
  // the pending save fires with its captured value, so typed notes are never
  // dropped. (`save.mutate` is stable across renders.)
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function debouncedSaveNotes(value: string) {
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      save.mutate({ patch: { notes: value } });
    }, 600);
  }

  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor="qe-status">Status</Label>
        <select
          id="qe-status"
          value={status}
          onChange={(e) => {
            const v = e.target.value;
            setDraft((d) => ({ ...d, status: v }));
            save.mutate({ patch: { status: v || null } });
          }}
          className="h-11 rounded-md border border-input bg-card px-3 text-sm"
        >
          <option value="">—</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="qe-crew">Crew leader</Label>
        <select
          id="qe-crew"
          value={assignedSubId}
          onChange={(e) => {
            const v = e.target.value;
            setDraft((d) => ({ ...d, assignedSubId: v }));
            save.mutate({ patch: { assignedSubId: v || null } });
          }}
          className="h-11 rounded-md border border-input bg-card px-3 text-sm"
        >
          <option value="">Unassigned</option>
          {activeSubs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1.5 text-xs text-muted-foreground">
        <span>
          {job.scheduledStart
            ? `Scheduled ${job.scheduledStart}${
                job.scheduledEnd && job.scheduledEnd !== job.scheduledStart
                  ? ` → ${job.scheduledEnd}`
                  : ""
              }`
            : "Unscheduled — drag onto the calendar to schedule"}
        </span>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="qe-notes">Notes</Label>
        <textarea
          id="qe-notes"
          value={notes}
          onChange={(e) => {
            const v = e.target.value;
            setDraft((d) => ({ ...d, notes: v }));
            debouncedSaveNotes(v);
          }}
          rows={3}
          className="rounded-md border border-input bg-card px-3 py-2 text-sm"
        />
      </div>

      {savedFlash && (
        <div
          aria-live="polite"
          className="text-xs text-emerald-700 dark:text-emerald-400"
        >
          Saved.
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive"
        >
          {error}
        </div>
      )}

      <div className="pt-1">
        <Link
          href={`/jobs/${id}`}
          onClick={onClose}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium",
            "transition-colors hover:bg-muted/60 active:bg-muted",
          )}
        >
          Open full job
          <ExternalLink className="size-3.5" />
        </Link>
      </div>
    </>
  );
}
