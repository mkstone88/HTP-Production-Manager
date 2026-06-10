"use client";

import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { Draggable } from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, ChevronUp, CloudRain, Plus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { JobQuickEdit } from "@/components/jobs/job-quick-edit";
import { Button } from "@/components/ui/button";
import type { Job, Sub } from "@/lib/airtable/types";
import { subColor } from "@/lib/sub-color";
import { cn } from "@/lib/utils";

import type { CrewConflict } from "@/app/api/jobs/conflicts/route";
import type { ForecastDay, RainRiskJob } from "@/app/api/weather/route";

type JobsResponse = { jobs: Job[]; error?: string };
type SubsResponse = { subs: Sub[]; error?: string };

async function fetchConflicts(): Promise<CrewConflict[]> {
  const res = await fetch("/api/jobs/conflicts", { cache: "no-store" });
  const data = (await res.json()) as { conflicts?: CrewConflict[]; error?: string };
  if (!res.ok || !data.conflicts)
    throw new Error(data.error || "Failed to load conflicts");
  return data.conflicts;
}

type WeatherResponse = { days: ForecastDay[]; rainRisk: RainRiskJob[] };

async function fetchWeather(): Promise<WeatherResponse> {
  const res = await fetch("/api/weather", { cache: "no-store" });
  const data = (await res.json()) as Partial<WeatherResponse> & { error?: string };
  if (!res.ok || !data.days) throw new Error(data.error || "Failed to load weather");
  return { days: data.days, rainRisk: data.rainRisk ?? [] };
}

/** WMO weather code → compact glyph for calendar day cells. */
function weatherGlyph(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2) return "⛅";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 77) return "❄️";
  if (code >= 80 && code <= 82) return "🌦️";
  if (code >= 95) return "⛈️";
  return "";
}

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
  // null = untouched, so a ?focus= deep link starts the drawer open but the
  // user (or scheduling the job) can still close it afterwards.
  const [drawerOpenState, setDrawerOpenState] = useState<boolean | null>(null);
  const drawerOpen = drawerOpenState ?? Boolean(focusJobId);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const jobsQuery = useQuery({ queryKey: ["jobs"], queryFn: fetchJobs });
  // Invalidated together with ["jobs"] (prefix match), so it refreshes after
  // every drag/drop/resize/reassignment.
  const conflictsQuery = useQuery({
    queryKey: ["jobs", "conflicts"],
    queryFn: fetchConflicts,
  });
  const conflicts = useMemo(
    () => conflictsQuery.data ?? [],
    [conflictsQuery.data],
  );
  // Forecast changes slowly and the server caches the upstream call; a failed
  // fetch just hides the overlay rather than surfacing an error.
  const weatherQuery = useQuery({
    queryKey: ["weather"],
    queryFn: fetchWeather,
    staleTime: 15 * 60_000,
    retry: 0,
  });
  const weatherByDate = useMemo(() => {
    const m = new Map<string, ForecastDay>();
    for (const d of weatherQuery.data?.days ?? []) m.set(d.date, d);
    return m;
  }, [weatherQuery.data]);
  const rainRisk = weatherQuery.data?.rainRisk ?? [];
  const conflictJobIds = useMemo(() => {
    const s = new Set<string>();
    for (const c of conflicts) {
      s.add(c.jobs[0].id);
      s.add(c.jobs[1].id);
    }
    return s;
  }, [conflicts]);
  const subsQuery = useQuery({ queryKey: ["subs", "active"], queryFn: fetchSubs });

  const subsById = useMemo(() => {
    const m = new Map<string, Sub>();
    for (const s of subsQuery.data ?? []) m.set(s.id, s);
    return m;
  }, [subsQuery.data]);

  const allJobs = jobsQuery.data ?? [];
  const unscheduled = allJobs.filter(
    (j) => !j.scheduledStart && j.status !== "Completed",
  );
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
    // CSS.escape: the id comes from the URL, so quotes/brackets in a crafted
    // link must not turn into a querySelector syntax error.
    const el = document.querySelector(
      `[data-job-id="${CSS.escape(focusJobId)}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusJobId, jobsQuery.data]);

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
          <Link href="/capacity" prefetch>
            <Button size="sm" variant="outline" className="h-10 px-3 sm:h-9">
              <BarChart3 className="size-4" />
              Capacity
            </Button>
          </Link>
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
      {conflicts.length > 0 && (
        <details className="border-b bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm font-medium">
            <AlertTriangle className="size-4 shrink-0" />
            {conflicts.length === 1
              ? "1 crew overlap — worth a double-check"
              : `${conflicts.length} crew overlaps — worth a double-check`}
          </summary>
          <ul className="space-y-1 px-4 pb-3 text-sm">
            {conflicts.map((c, i) => (
              <li key={`${c.subId}-${i}`}>
                <span className="font-medium">{c.subName}</span>:{" "}
                {c.jobs[0].name} & {c.jobs[1].name} overlap{" "}
                <span className="tabular-nums">
                  {c.overlapStart}
                  {c.overlapEnd !== c.overlapStart ? ` → ${c.overlapEnd}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {rainRisk.length > 0 && (
        <details className="border-b bg-sky-50 text-sky-900 dark:bg-sky-900/20 dark:text-sky-200">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm font-medium">
            <CloudRain className="size-4 shrink-0" />
            {rainRisk.length === 1
              ? "Rain risk on 1 exterior job"
              : `Rain risk on ${rainRisk.length} exterior jobs`}
          </summary>
          <ul className="space-y-1 px-4 pb-3 text-sm">
            {rainRisk.map((j) => (
              <li key={j.id}>
                <span className="font-medium">{j.name}</span>{" "}
                <span className="opacity-80">
                  ({j.projectType}) —{" "}
                  {j.days
                    .map(
                      (d) =>
                        `${d.date.slice(5).replace("-", "/")} ${d.precipProbability}%`,
                    )
                    .join(", ")}
                </span>
              </li>
            ))}
          </ul>
        </details>
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
          {/* Drawer handle (mobile only) */}
          <button
            type="button"
            onClick={() => setDrawerOpenState(!drawerOpen)}
            className={cn(
              "flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-semibold lg:hidden",
              "active:bg-muted/60 transition-colors",
            )}
            aria-expanded={drawerOpen}
          >
            <span>
              Unscheduled{" "}
              <span className="text-muted-foreground">({unscheduled.length})</span>
            </span>
            <ChevronUp
              className={cn(
                "size-5 transition-transform duration-200",
                drawerOpen && "rotate-180",
              )}
            />
          </button>
          {/* Desktop header */}
          <div className="hidden px-4 py-3 text-sm font-semibold lg:block">
            Unscheduled{" "}
            <span className="text-muted-foreground">({unscheduled.length})</span>
          </div>

          <div className="flex flex-col gap-2 overflow-auto px-3 pb-4 lg:max-h-[calc(100dvh-9rem)]">
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
                  "min-h-12 cursor-grab touch-none select-none rounded-lg border bg-card p-3 text-sm shadow-sm",
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
            dayCellContent={(arg) => {
              const iso = toDateOnly(arg.date);
              const fc = iso ? weatherByDate.get(iso) : undefined;
              if (!fc) return arg.dayNumberText;
              const glyph = weatherGlyph(fc.weatherCode);
              return (
                <div className="flex items-center justify-end gap-1">
                  <span
                    className="text-[10px] leading-none opacity-80"
                    title={`${fc.precipProbability}% rain · ${fc.tempMaxF}°/${fc.tempMinF}°`}
                  >
                    {glyph}
                    {fc.precipProbability >= 30
                      ? ` ${fc.precipProbability}%`
                      : ""}
                  </span>
                  <span>{arg.dayNumberText}</span>
                </div>
              );
            }}
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
              const hasConflict = Boolean(
                props.jobId && conflictJobIds.has(props.jobId),
              );
              const isWeek = info.view.type === "dayGridWeek";
              if (!isWeek) {
                // Month view: compact one-liner so we can fit several per cell.
                return (
                  <div className="flex items-center gap-1 overflow-hidden truncate px-1 leading-tight">
                    {hasConflict && (
                      <AlertTriangle className="size-3 shrink-0 text-amber-300" />
                    )}
                    <span className="truncate font-medium">{info.event.title}</span>
                  </div>
                );
              }
              // Week view: roomier card with crew + status.
              return (
                <div className="flex flex-col gap-0.5 overflow-hidden px-1.5 py-1 leading-tight">
                  <div className="flex items-center gap-1 truncate text-[12px] font-semibold">
                    {hasConflict && (
                      <AlertTriangle className="size-3 shrink-0 text-amber-300" />
                    )}
                    <span className="truncate">{info.event.title}</span>
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
