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
  scheduledStart: string | null;
  scheduledEnd: string | null;
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
  const qc = useQueryClient();

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

  // Local mirrors so the inputs don't flicker mid-save.
  const [status, setStatus] = useState<typeof statuses[number] | "">("");
  const [assignedSubId, setAssignedSubId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const j = job.data;
    if (!j) return;
    setStatus(j.status ?? "");
    setAssignedSubId(j.assignedSubId ?? "");
    setNotes(j.notes ?? "");
  }, [job.data]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const save = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: JobPatchPayload }) =>
      patchJob(id, patch),
    onSuccess: (_data, vars) => {
      const keys = Object.keys(vars.patch);
      setSavedFlash(keys[0] ?? "field");
      setTimeout(() => setSavedFlash(null), 1200);
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["job", vars.id] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Save failed"),
  });

  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function debouncedSaveNotes(value: string, id: string) {
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      save.mutate({ id, patch: { notes: value } });
    }, 600);
  }

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
          "relative w-full max-w-md overflow-hidden bg-background shadow-xl",
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
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="qe-status">Status</Label>
                <select
                  id="qe-status"
                  value={status}
                  onChange={(e) => {
                    const v = e.target.value as typeof statuses[number];
                    setStatus(v);
                    save.mutate({ id, patch: { status: v || null } });
                  }}
                  className="h-11 rounded-md border border-input bg-background px-3 text-sm"
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
                    setAssignedSubId(v);
                    save.mutate({
                      id,
                      patch: { assignedSubId: v || null },
                    });
                  }}
                  className="h-11 rounded-md border border-input bg-background px-3 text-sm"
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
                  {j.scheduledStart
                    ? `Scheduled ${j.scheduledStart}${
                        j.scheduledEnd && j.scheduledEnd !== j.scheduledStart
                          ? ` → ${j.scheduledEnd}`
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
                    setNotes(e.target.value);
                    debouncedSaveNotes(e.target.value, id);
                  }}
                  rows={3}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
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
          )}
        </div>
      </div>
    </div>
  );
}
