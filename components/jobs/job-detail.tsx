"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  JobStatus,
  ProjectType,
  type Job,
  type Sub,
} from "@/lib/airtable/types";

const statuses = JobStatus.options;
const projectTypes = ProjectType.options;

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
 * Local edits live in a draft that holds ONLY the fields the user has touched;
 * everything else renders the live server value. Two bugs this avoids:
 *  - a background refetch can never clobber in-progress edits (the old
 *    seed-state-in-effect reset every field whenever job.data changed), and
 *  - saving sends only the fields that actually differ from the server, so a
 *    stale open tab can't overwrite a concurrent edit (e.g. a reschedule made
 *    on the Schedule view) with old values.
 */
const DRAFT_KEYS = [
  "status",
  "projectType",
  "scheduledStart",
  "scheduledEnd",
  "assignedSubId",
  "notes",
] as const;
type DraftKey = (typeof DRAFT_KEYS)[number];
type Draft = Partial<Record<DraftKey, string>>;

export function JobDetail({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const job = useQuery({ queryKey: ["job", id], queryFn: () => fetchJob(id) });
  const subs = useQuery({ queryKey: ["subs"], queryFn: fetchSubs });

  const [draft, setDraft] = useState<Draft>({});
  const [error, setError] = useState<string | null>(null);

  const setField = (key: DraftKey, value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const save = useMutation({
    mutationFn: async (changes: Partial<Record<DraftKey, string | null>>): Promise<Job> => {
      const res = await fetch(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      const data = (await res.json()) as { job?: Job; error?: string };
      if (!res.ok || !data.job) throw new Error(data.error || "Save failed");
      return data.job;
    },
    onSuccess: (saved) => {
      // Seed the cache with the response before clearing the draft so the
      // form never flashes back to pre-save values.
      qc.setQueryData(["job", id], saved);
      qc.invalidateQueries({ queryKey: ["jobs"] });
      setDraft({});
      setError(null);
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Save failed"),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/jobs/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Delete failed");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      router.push("/jobs");
      router.refresh();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Delete failed"),
  });

  if (job.isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  }
  if (job.error || !job.data) {
    return (
      <div className="m-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        {job.error instanceof Error ? job.error.message : "Failed to load job"}
      </div>
    );
  }

  const j = job.data;

  // Touched fields show the draft; untouched fields track the server.
  const view: Record<DraftKey, string> = {
    status: draft.status ?? j.status ?? "",
    projectType: draft.projectType ?? j.projectType ?? "",
    scheduledStart: draft.scheduledStart ?? j.scheduledStart ?? "",
    scheduledEnd: draft.scheduledEnd ?? j.scheduledEnd ?? "",
    assignedSubId: draft.assignedSubId ?? j.assignedSubId ?? "",
    notes: draft.notes ?? j.notes ?? "",
  };

  // Only fields that actually differ from the server go in the PATCH
  // (empty string means "clear" → null; the API leaves omitted keys untouched).
  const changes: Partial<Record<DraftKey, string | null>> = {};
  for (const key of DRAFT_KEYS) {
    const touched = draft[key];
    if (touched === undefined) continue;
    const normalized = touched || null;
    if (normalized !== ((j[key] as string | undefined) ?? null)) {
      changes[key] = normalized;
    }
  }
  const isDirty = Object.keys(changes).length > 0;

  return (
    <div className="flex flex-1 flex-col bg-card">
      <div className="border-b px-4 py-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {j.jobNumber || "—"}
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          {j.name || j.customerName || "Job"}
        </h1>
        {(j.customerName || j.address) && (
          <div className="mt-1 text-sm text-muted-foreground">
            {[j.customerName, j.address].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>

      <form
        className="grid max-w-xl gap-5 p-4 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (isDirty) save.mutate(changes);
        }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              value={view.status}
              onChange={(e) => setField("status", e.target.value)}
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
            <Label htmlFor="projectType">Project type</Label>
            <select
              id="projectType"
              value={view.projectType}
              onChange={(e) => setField("projectType", e.target.value)}
              className="h-11 rounded-md border border-input bg-card px-3 text-sm"
            >
              <option value="">—</option>
              {projectTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="scheduledStart">Start date</Label>
            <Input
              id="scheduledStart"
              type="date"
              value={view.scheduledStart}
              onChange={(e) => setField("scheduledStart", e.target.value)}
              className="h-11"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="scheduledEnd">End date</Label>
            <Input
              id="scheduledEnd"
              type="date"
              value={view.scheduledEnd}
              onChange={(e) => setField("scheduledEnd", e.target.value)}
              className="h-11"
              min={view.scheduledStart || undefined}
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="crew">Crew leader</Label>
          <select
            id="crew"
            value={view.assignedSubId}
            onChange={(e) => setField("assignedSubId", e.target.value)}
            className="h-11 rounded-md border border-input bg-card px-3 text-sm"
          >
            <option value="">Unassigned</option>
            {(subs.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="notes">Notes</Label>
          <textarea
            id="notes"
            value={view.notes}
            onChange={(e) => setField("notes", e.target.value)}
            rows={4}
            className="rounded-md border border-input bg-card px-3 py-2 text-sm"
          />
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        <div className="sticky bottom-0 -mx-4 flex gap-2 border-t bg-card/95 p-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          <Button
            type="submit"
            disabled={save.isPending || !isDirty}
            className="h-12 flex-1 sm:h-11 sm:flex-none"
          >
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            className="h-12 sm:h-11"
          >
            Back
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (confirm("Delete this job? This cannot be undone.")) remove.mutate();
            }}
            disabled={remove.isPending}
            className="h-12 text-destructive hover:bg-destructive/10 sm:h-11"
            aria-label="Delete job"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
