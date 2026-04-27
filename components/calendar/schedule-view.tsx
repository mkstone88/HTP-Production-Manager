"use client";

import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { Draggable } from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { Job } from "@/lib/airtable/types";
import type { Sub } from "@/lib/airtable/types";
import { cn } from "@/lib/utils";

type JobsResponse = { jobs: Job[]; error?: string };
type SubsResponse = { subs: Sub[]; error?: string };

async function fetchJobs(): Promise<Job[]> {
  const res = await fetch("/api/jobs", { cache: "no-store" });
  const data = (await res.json()) as JobsResponse;
  if (!res.ok) throw new Error(data.error || "Failed to load jobs");
  return data.jobs;
}

async function fetchSubs(): Promise<Sub[]> {
  const res = await fetch("/api/subs?activeOnly=true", { cache: "no-store" });
  const data = (await res.json()) as SubsResponse;
  if (!res.ok) throw new Error(data.error || "Failed to load subcontractors");
  return data.subs;
}

async function patchJob(id: string, patch: Partial<Job>): Promise<Job> {
  const res = await fetch(`/api/jobs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = (await res.json()) as { job?: Job; error?: string };
  if (!res.ok || !data.job) throw new Error(data.error || "Failed to update job");
  return data.job;
}

export function ScheduleView() {
  const qc = useQueryClient();
  const [subFilter, setSubFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const jobsQuery = useQuery({ queryKey: ["jobs"], queryFn: fetchJobs });
  const subsQuery = useQuery({ queryKey: ["subs", "active"], queryFn: fetchSubs });

  const subsById = useMemo(() => {
    const m = new Map<string, Sub>();
    for (const s of subsQuery.data ?? []) m.set(s.id, s);
    return m;
  }, [subsQuery.data]);

  const allJobs = jobsQuery.data ?? [];
  const unscheduled = allJobs.filter((j) => !j.scheduledStart);
  const scheduled = allJobs.filter((j) => j.scheduledStart);
  const visibleScheduled = subFilter
    ? scheduled.filter((j) => j.assignedSubId === subFilter)
    : scheduled;

  const updateJob = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Job> }) =>
      patchJob(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ["jobs"] });
      const prev = qc.getQueryData<Job[]>(["jobs"]);
      qc.setQueryData<Job[]>(["jobs"], (old) =>
        (old ?? []).map((j) => (j.id === id ? { ...j, ...patch } : j)),
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["jobs"], ctx.prev);
      setError(err instanceof Error ? err.message : "Update failed");
    },
    onSuccess: () => setError(null),
    onSettled: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });

  const draggableContainer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!draggableContainer.current) return;
    const draggable = new Draggable(draggableContainer.current, {
      itemSelector: "[data-draggable-job]",
      eventData: (el) => ({
        title: el.getAttribute("data-job-title") || "Job",
        duration: "08:00",
        extendedProps: { jobId: el.getAttribute("data-job-id") },
      }),
    });
    return () => draggable.destroy();
  }, []);

  const events = useMemo(
    () =>
      visibleScheduled.map((j) => ({
        id: j.id,
        title: j.name,
        start: j.scheduledStart,
        end: j.scheduledEnd || undefined,
        extendedProps: { jobId: j.id, subId: j.assignedSubId },
        backgroundColor: subColor(j.assignedSubId),
        borderColor: subColor(j.assignedSubId),
      })),
    [visibleScheduled],
  );

  const loading = jobsQuery.isLoading || subsQuery.isLoading;
  const loadError =
    (jobsQuery.error instanceof Error && jobsQuery.error.message) ||
    (subsQuery.error instanceof Error && subsQuery.error.message);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Schedule</h1>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Sub</label>
          <select
            value={subFilter}
            onChange={(e) => setSubFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">All subs</option>
            {(subsQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loadError && (
        <div className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {loadError} —{" "}
          <span className="text-xs">
            Have you set <code>AIRTABLE_PAT</code> + <code>AIRTABLE_BASE_ID</code> in
            <code> .env.local</code>, and are the table/field names in
            <code> lib/airtable/mapping.ts</code> correct?
          </span>
        </div>
      )}
      {error && (
        <div className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-1 flex-col lg:flex-row">
        <aside
          ref={draggableContainer}
          className="border-b lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r"
        >
          <div className="px-4 py-3 text-sm font-semibold">
            Unscheduled <span className="text-muted-foreground">({unscheduled.length})</span>
          </div>
          <div className="flex max-h-[40vh] flex-col gap-2 overflow-auto px-3 pb-3 lg:max-h-[calc(100dvh-9rem)]">
            {loading && (
              <div className="text-sm text-muted-foreground">Loading…</div>
            )}
            {!loading && unscheduled.length === 0 && (
              <div className="text-sm text-muted-foreground">
                No unscheduled jobs.
              </div>
            )}
            {unscheduled.map((j) => (
              <div
                key={j.id}
                data-draggable-job
                data-job-id={j.id}
                data-job-title={j.name}
                className={cn(
                  "cursor-grab rounded-md border bg-card p-3 text-sm shadow-sm active:cursor-grabbing",
                )}
              >
                <div className="font-medium">{j.name}</div>
                {j.client && (
                  <div className="text-xs text-muted-foreground">{j.client}</div>
                )}
                {j.assignedSubId && (
                  <div className="mt-1 text-xs">
                    Sub: {subsById.get(j.assignedSubId)?.name ?? "—"}
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>

        <div className="flex-1 p-2 sm:p-4">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            height="auto"
            droppable
            editable
            events={events}
            longPressDelay={150}
            eventReceive={(info) => {
              const jobId = info.event.extendedProps.jobId as string | undefined;
              if (!jobId) return;
              const start = info.event.start?.toISOString();
              const end = info.event.end?.toISOString();
              info.event.remove(); // we re-render from server data
              if (!start) return;
              updateJob.mutate({
                id: jobId,
                patch: {
                  scheduledStart: start,
                  scheduledEnd: end,
                  assignedSubId: subFilter || undefined,
                },
              });
            }}
            eventDrop={(info) => {
              const jobId = info.event.extendedProps.jobId as string | undefined;
              const start = info.event.start?.toISOString();
              const end = info.event.end?.toISOString();
              if (!jobId || !start) {
                info.revert();
                return;
              }
              updateJob.mutate({
                id: jobId,
                patch: { scheduledStart: start, scheduledEnd: end },
              });
            }}
            eventResize={(info) => {
              const jobId = info.event.extendedProps.jobId as string | undefined;
              const start = info.event.start?.toISOString();
              const end = info.event.end?.toISOString();
              if (!jobId || !start) {
                info.revert();
                return;
              }
              updateJob.mutate({
                id: jobId,
                patch: { scheduledStart: start, scheduledEnd: end },
              });
            }}
          />
        </div>
      </div>
    </div>
  );
}

function subColor(subId?: string): string | undefined {
  if (!subId) return "#71717a"; // zinc-500 for unassigned
  // Deterministic hue per subId so each sub keeps a stable color.
  let h = 0;
  for (let i = 0; i < subId.length; i++) {
    h = (h * 31 + subId.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return `oklch(0.55 0.15 ${hue})`;
}
