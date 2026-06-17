"use client";

import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { Draggable } from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronUp, Plus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { JobQuickEdit } from "@/components/jobs/job-quick-edit";
import { Button } from "@/components/ui/button";
import type { Job, Sub } from "@/lib/airtable/types";
import { subColor } from "@/lib/sub-color";
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

/**
 * FullCalendar all-day end is exclusive: an event spanning 4/27→4/29 is
 * `start: "2026-04-27", end: "2026-04-30"`. Airtable stores inclusive dates,
 * so we add a day on the way out and subtract on the way in.
 */
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function toDateOnly(d: Date | null): string | undefined {
  if (!d) return undefined;
  // Use local date components so dragging on a calendar in the user's TZ
  // produces the date the user actually dropped on.
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function ScheduleView() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  // ?focus=<jobId> — set when the user lands here from the Triage tab's
  // Schedule pill. Forces the unscheduled drawer open and highlights+scrolls
  // to that card so they can drag it onto a date.
  const focusJobId = searchParams.get("focus") ?? undefined;

  const [subFilter, setSubFilter] = useState<string>("");
  const [showCompleted, setShowCompleted] = useState(true);
  const [drawerOpenState, setDrawerOpenState] = useState(false);
  const drawerOpen = drawerOpenState || Boolean(focusJobId);
  // Which list the unscheduled drawer is showing. "On Hold" jobs are split out
  // so they don't clutter the day-to-day scheduling queue.
  const [drawerTab, setDrawerTab] = useState<"unscheduled" | "onHold">(
    "unscheduled",
  );
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const jobsQuery = useQuery({ queryKey: ["jobs"], queryFn: fetchJobs });
  const subsQuery = useQuery({ queryKey: ["subs", "active"], queryFn: fetchSubs });

  const subsById = useMemo(() => {
    const m = new Map<string, Sub>();
    for (const s of subsQuery.data ?? []) m.set(s.id, s);
    return m;
  }, [subsQuery.data]);

  const allJobs = jobsQuery.data ?? [];
  // Jobs awaiting a date, split into the active queue and an On Hold parking lot.
  const unscheduled = allJobs.filter(
    (j) =>
      !j.scheduledStart && j.status !== "Completed" && j.status !== "On Hold",
  );
  const onHold = allJobs.filter(
    (j) => !j.scheduledStart && j.status === "On Hold",
  );
  // A focused job (deep-linked from Triage) forces its tab open, the same way
  // it forces the drawer open — otherwise honor the user's manual selection.
  const focusedJob = focusJobId
    ? allJobs.find((j) => j.id === focusJobId)
    : undefined;
  const activeTab: "unscheduled" | "onHold" = focusedJob
    ? focusedJob.status === "On Hold"
      ? "onHold"
      : "unscheduled"
    : drawerTab;
  const drawerJobs = activeTab === "onHold" ? onHold : unscheduled;
  const scheduled = allJobs.filter((j) => j.scheduledStart);
  const visibleScheduled = scheduled.filter((j) => {
    if (subFilter && j.assignedSubId !== subFilter) return false;
    if (!showCompleted && j.status === "Completed") return false;
    return true;
  });

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
        allDay: true,
        create: true,
        extendedProps: { jobId: el.getAttribute("data-job-id") },
      }),
    });
    return () => draggable.destroy();
  }, []);

  // Scroll the focused job into view once it's actually rendered.
  useEffect(() => {
    if (!focusJobId) return;
    const el = document.querySelector(`[data-job-id="${focusJobId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusJobId, jobsQuery.data, activeTab]);

  const events = useMemo(
    () =>
      visibleScheduled.map((j) => {
        const isCompleted = j.status === "Completed";
        const isOnHold = j.status === "On Hold";
        const color = subColor({
          subId: j.assignedSubId,
          override: j.assignedSubId
            ? subsById.get(j.assignedSubId)?.color
            : undefined,
          completed: isCompleted,
          onHold: isOnHold,
        });
        const textColor = isCompleted
          ? "#71717a"
          : isOnHold
            ? "#475569"
            : "#ffffff";
        const classNames = isCompleted
          ? ["job-event-completed"]
          : isOnHold
            ? ["job-event-onhold"]
            : ["job-event"];
        return {
          id: j.id,
          title: j.name || j.customerName || "Job",
          start: j.scheduledStart,
          end: j.scheduledEnd ? addDays(j.scheduledEnd, 1) : undefined,
          allDay: true,
          extendedProps: {
            jobId: j.id,
            subId: j.assignedSubId,
            completed: isCompleted,
            onHold: isOnHold,
            customerName: j.customerName,
            status: j.status,
          },
          backgroundColor: color,
          borderColor: isOnHold ? "#94a3b8" : color,
          textColor,
          classNames,
        };
      }),
    [visibleScheduled, subsById],
  );

  const loading = jobsQuery.isLoading || subsQuery.isLoading;
  const loadError =
    (jobsQuery.error instanceof Error && jobsQuery.error.message) ||
    (subsQuery.error instanceof Error && subsQuery.error.message);

  return (
    <div className="flex flex-1 flex-col">
      {/* Top toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 sm:gap-3 sm:px-4 sm:py-3">
        <h1 className="text-lg font-semibold">Schedule</h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Link href="/jobs/new" prefetch>
            <Button size="sm" className="h-10 px-3 sm:h-9">
              <Plus className="size-4" />
              New job
            </Button>
          </Link>
          <select
            value={subFilter}
            onChange={(e) => setSubFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-2 text-sm sm:h-9"
            aria-label="Filter by sub"
          >
            <option value="">All subs</option>
            {(subsQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <label className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm sm:h-9">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="size-4"
            />
            <span className="select-none">Show completed</span>
          </label>
        </div>
      </div>

      {loadError && (
        <div className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {loadError} —{" "}
          <span className="text-xs">
            Have you set <code>AIRTABLE_PAT</code> + <code>AIRTABLE_BASE_ID</code> in
            <code> .env.local</code>?
          </span>
        </div>
      )}
      {error && (
        <div className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="relative flex flex-1 flex-col lg:flex-row">
        {/* Desktop: persistent sidebar. Mobile: bottom drawer with peek. */}
        <aside
          ref={draggableContainer}
          className={cn(
            "z-20 border-t bg-background transition-transform duration-300 ease-out",
            "lg:relative lg:order-first lg:w-72 lg:shrink-0 lg:translate-y-0 lg:border-r lg:border-t-0",
            // Mobile: fixed bottom drawer; transform between collapsed and expanded
            "fixed inset-x-0 bottom-0 max-h-[70dvh] rounded-t-xl shadow-[0_-8px_24px_rgba(0,0,0,0.08)] lg:max-h-none lg:rounded-none lg:shadow-none",
            drawerOpen ? "translate-y-0" : "translate-y-[calc(100%-3.25rem)]",
          )}
          aria-label="Unscheduled jobs"
        >
          {/* Header: tab switcher (always visible, doubles as the mobile peek).
              Tapping a tab also expands the drawer; the chevron collapses it. */}
          <div className="flex items-center gap-1 px-2 py-2" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "unscheduled"}
              onClick={() => {
                setDrawerTab("unscheduled");
                setDrawerOpenState(true);
              }}
              className={cn(
                "flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors",
                activeTab === "unscheduled"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground active:bg-muted/60",
              )}
            >
              Unscheduled{" "}
              <span className="text-muted-foreground">({unscheduled.length})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "onHold"}
              onClick={() => {
                setDrawerTab("onHold");
                setDrawerOpenState(true);
              }}
              className={cn(
                "flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors",
                activeTab === "onHold"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground active:bg-muted/60",
              )}
            >
              On Hold{" "}
              <span className="text-muted-foreground">({onHold.length})</span>
            </button>
            {/* Mobile-only collapse toggle */}
            <button
              type="button"
              onClick={() => setDrawerOpenState((v) => !v)}
              className="shrink-0 rounded-md p-2 active:bg-muted/60 lg:hidden"
              aria-label={drawerOpen ? "Collapse drawer" : "Expand drawer"}
              aria-expanded={drawerOpen}
            >
              <ChevronUp
                className={cn(
                  "size-5 transition-transform duration-200",
                  drawerOpen && "rotate-180",
                )}
              />
            </button>
          </div>

          <div className="flex flex-col gap-2 overflow-y-auto overscroll-contain px-3 pb-4 lg:max-h-[calc(100dvh-9rem)]">
            {loading && (
              <div className="text-sm text-muted-foreground">Loading…</div>
            )}
            {!loading && drawerJobs.length === 0 && (
              <div className="text-sm text-muted-foreground">
                {activeTab === "onHold"
                  ? "No jobs on hold."
                  : "No unscheduled jobs."}
              </div>
            )}
            {drawerJobs.map((j) => (
              <div
                key={j.id}
                data-draggable-job
                data-job-id={j.id}
                data-job-title={j.name || j.customerName || "Job"}
                onClick={() => setEditingJobId(j.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setEditingJobId(j.id);
                  }
                }}
                className={cn(
                  // touch-pan-y (not touch-none) so a swipe scrolls the list on
                  // mobile; FullCalendar's long-press still initiates a drag.
                  "min-h-12 cursor-grab touch-pan-y select-none rounded-lg border bg-card p-3 text-sm shadow-sm",
                  "transition-all duration-150 active:scale-[0.98] active:cursor-grabbing active:shadow-md",
                  focusJobId === j.id && "ring-2 ring-amber-500 ring-offset-2",
                )}
              >
                <div className="font-medium">{j.name || j.customerName || "Job"}</div>
                {j.customerName && j.name && (
                  <div className="text-xs text-muted-foreground">{j.customerName}</div>
                )}
                <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                  {j.assignedSubId ? (
                    <span className="text-muted-foreground">
                      {subsById.get(j.assignedSubId)?.name ?? "Sub"}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                  {j.status && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
                      {j.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Calendar */}
        <div className="flex-1 p-2 pb-16 sm:p-4 lg:pb-4">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,dayGridWeek",
            }}
            buttonText={{ today: "Today", month: "Month", week: "Week" }}
            views={{
              dayGridWeek: {
                dayMaxEvents: false,   // show every event, no "+N more"
                dayHeaderFormat: { weekday: "short", day: "numeric" },
              },
              dayGridMonth: {
                dayMaxEvents: 4,
              },
            }}
            height="auto"
            droppable
            editable
            eventDurationEditable
            events={events}
            longPressDelay={120}
            eventLongPressDelay={120}
            selectLongPressDelay={120}
            eventContent={(info) => {
              const props = info.event.extendedProps as {
                jobId?: string;
                subId?: string;
                completed?: boolean;
                customerName?: string;
                status?: string;
              };
              const sub = props.subId ? subsById.get(props.subId) : null;
              const isWeek = info.view.type === "dayGridWeek";
              if (!isWeek) {
                // Month view: compact one-liner so we can fit several per cell.
                return (
                  <div className="overflow-hidden truncate px-1 leading-tight">
                    <span className="font-medium">{info.event.title}</span>
                  </div>
                );
              }
              // Week view: roomier card with crew + status.
              return (
                <div className="flex flex-col gap-0.5 overflow-hidden px-1.5 py-1 leading-tight">
                  <div className="truncate text-[12px] font-semibold">
                    {info.event.title}
                  </div>
                  {props.customerName && (
                    <div className="truncate text-[11px] opacity-90">
                      {props.customerName}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-1 text-[10.5px] opacity-90">
                    <span className="truncate">
                      {sub ? sub.name : "Unassigned"}
                    </span>
                    {/* Only badge unusual statuses; On Hold and Completed are
                        already visually distinct via the card styling. */}
                    {props.status === "Proposal Accepted" ||
                    props.status === "In Progress" ? (
                      <span className="shrink-0 rounded-sm bg-white/20 px-1 py-px">
                        {props.status}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            }}
            eventReceive={(info) => {
              const jobId = info.event.extendedProps.jobId as string | undefined;
              if (!jobId) return;
              const start = toDateOnly(info.event.start);
              info.event.remove();
              if (!start) return;
              updateJob.mutate({
                id: jobId,
                patch: {
                  scheduledStart: start,
                  scheduledEnd: start,
                  ...(subFilter ? { assignedSubId: subFilter } : {}),
                },
              });
              setDrawerOpenState(false);
            }}
            eventDrop={(info) => {
              const jobId = info.event.extendedProps.jobId as string | undefined;
              const start = toDateOnly(info.event.start);
              const fcEnd = toDateOnly(info.event.end);
              if (!jobId || !start) {
                info.revert();
                return;
              }
              const end = fcEnd ? addDays(fcEnd, -1) : start;
              updateJob.mutate({
                id: jobId,
                patch: { scheduledStart: start, scheduledEnd: end },
              });
            }}
            eventClick={(info) => {
              const jobId = info.event.extendedProps.jobId as string | undefined;
              if (jobId) setEditingJobId(jobId);
            }}
            eventResize={(info) => {
              const jobId = info.event.extendedProps.jobId as string | undefined;
              const start = toDateOnly(info.event.start);
              const fcEnd = toDateOnly(info.event.end);
              if (!jobId || !start) {
                info.revert();
                return;
              }
              const end = fcEnd ? addDays(fcEnd, -1) : start;
              updateJob.mutate({
                id: jobId,
                patch: { scheduledStart: start, scheduledEnd: end },
              });
            }}
          />
        </div>
      </div>

      <JobQuickEdit
        jobId={editingJobId}
        onClose={() => setEditingJobId(null)}
      />
    </div>
  );
}
