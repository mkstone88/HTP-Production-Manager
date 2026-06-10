"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, MapPin, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  JobStatus,
  ProjectType,
  type Job,
  type Sub,
} from "@/lib/airtable/types";
import { isHttpUrl, mapsHref } from "@/lib/contact-links";

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

export function JobDetail({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const job = useQuery({ queryKey: ["job", id], queryFn: () => fetchJob(id) });
  const subs = useQuery({ queryKey: ["subs"], queryFn: fetchSubs });

  const [status, setStatus] = useState<typeof statuses[number] | "">("");
  const [projectType, setProjectType] = useState<typeof projectTypes[number] | "">("");
  const [scheduledStart, setScheduledStart] = useState("");
  const [scheduledEnd, setScheduledEnd] = useState("");
  const [assignedSubId, setAssignedSubId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const j = job.data;
    if (!j) return;
    setStatus(j.status ?? "");
    setProjectType(j.projectType ?? "");
    setScheduledStart(j.scheduledStart ?? "");
    setScheduledEnd(j.scheduledEnd ?? "");
    setAssignedSubId(j.assignedSubId ?? "");
    setNotes(j.notes ?? "");
  }, [job.data]);

  const save = useMutation({
    mutationFn: async (): Promise<Job> => {
      const body: Record<string, unknown> = {
        status: status || null,
        projectType: projectType || null,
        scheduledStart: scheduledStart || null,
        scheduledEnd: scheduledEnd || null,
        assignedSubId: assignedSubId || null,
        notes: notes,
      };
      const res = await fetch(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { job?: Job; error?: string };
      if (!res.ok || !data.job) throw new Error(data.error || "Save failed");
      return data.job;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job", id] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
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

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b px-4 py-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {j.jobNumber || "—"}
        </div>
        <h1 className="text-lg font-semibold">
          {j.name || j.customerName || "Job"}
        </h1>
        {(j.customerName || j.address) && (
          <div className="mt-1 text-sm text-muted-foreground">
            {j.customerName}
            {j.customerName && j.address && " · "}
            {j.address && (
              <a
                href={mapsHref(j.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
              >
                <MapPin className="size-3.5" />
                {j.address}
              </a>
            )}
          </div>
        )}
        {j.workOrderUrl && isHttpUrl(j.workOrderUrl) && (
          <a
            href={j.workOrderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors hover:bg-muted/60 active:bg-muted"
          >
            Open work order
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>

      <form
        className="grid max-w-xl gap-5 p-4 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof statuses[number])}
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
            <Label htmlFor="projectType">Project type</Label>
            <select
              id="projectType"
              value={projectType}
              onChange={(e) =>
                setProjectType(e.target.value as typeof projectTypes[number])
              }
              className="h-11 rounded-md border border-input bg-background px-3 text-sm"
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
              value={scheduledStart}
              onChange={(e) => setScheduledStart(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="scheduledEnd">End date</Label>
            <Input
              id="scheduledEnd"
              type="date"
              value={scheduledEnd}
              onChange={(e) => setScheduledEnd(e.target.value)}
              className="h-11"
              min={scheduledStart || undefined}
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="crew">Crew leader</Label>
          <select
            id="crew"
            value={assignedSubId}
            onChange={(e) => setAssignedSubId(e.target.value)}
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
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
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="sticky bottom-0 -mx-4 flex gap-2 border-t bg-background/95 p-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          <Button
            type="submit"
            disabled={save.isPending}
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
