import type { Job, Sub } from "@/lib/airtable/types";

/**
 * Weekly crew workload, derived from scheduled jobs.
 *
 * A job's labor is `Estimated Hours` when present, otherwise 8h per scheduled
 * day. Hours are spread evenly across the job's scheduled days (inclusive),
 * then bucketed into Monday-start weeks. Capacity per crew comes from the
 * `Weekly Capacity Hours` field on Crews, defaulting to 40.
 *
 * Pure function — the API route feeds it jobs + subs; a future agent tool
 * ("how booked is Crew X in July?") calls the same endpoint.
 */

export const DEFAULT_WEEKLY_CAPACITY_HOURS = 40;
export const FALLBACK_HOURS_PER_DAY = 8;

export type CrewWeekLoad = {
  subId: string;
  subName: string;
  color?: string;
  hours: number;
  capacityHours: number;
  jobs: { id: string; name: string; hours: number }[];
};

export type CapacityWeek = {
  /** Monday, YYYY-MM-DD. */
  start: string;
  /** Sunday, YYYY-MM-DD. */
  end: string;
  crews: CrewWeekLoad[];
  /** Hours scheduled on jobs with no crew assigned. */
  unassignedHours: number;
  totalHours: number;
  totalCapacity: number;
};

function toUtc(iso: string): number {
  return Date.UTC(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10)),
  );
}

function toIso(utc: number): string {
  return new Date(utc).toISOString().slice(0, 10);
}

const DAY_MS = 86_400_000;

/** Monday of the week containing `iso`. */
export function mondayOf(iso: string): string {
  const utc = toUtc(iso);
  const dow = new Date(utc).getUTCDay(); // 0 = Sunday
  const back = dow === 0 ? 6 : dow - 1;
  return toIso(utc - back * DAY_MS);
}

export function computeCapacity(
  jobs: Job[],
  subs: Sub[],
  opts: { today: string; weeks?: number },
): CapacityWeek[] {
  const weekCount = Math.min(Math.max(opts.weeks ?? 6, 1), 16);
  const firstMonday = toUtc(mondayOf(opts.today));

  const scheduled = jobs.filter(
    (j) =>
      j.scheduledStart && j.status !== "Completed" && j.status !== "On Hold",
  );

  // Crews to always show: active ones, so idle capacity is visible too.
  const activeSubs = subs.filter(
    (s) => s.status === "Active" || s.status === "Onboarding",
  );
  const subsById = new Map(subs.map((s) => [s.id, s]));

  const weeks: CapacityWeek[] = [];
  for (let w = 0; w < weekCount; w++) {
    const weekStart = firstMonday + w * 7 * DAY_MS;
    const weekEnd = weekStart + 6 * DAY_MS;

    const crews = new Map<string, CrewWeekLoad>();
    for (const s of activeSubs) {
      crews.set(s.id, {
        subId: s.id,
        subName: s.name,
        color: s.color,
        hours: 0,
        capacityHours: s.weeklyCapacityHours ?? DEFAULT_WEEKLY_CAPACITY_HOURS,
        jobs: [],
      });
    }
    let unassignedHours = 0;

    for (const j of scheduled) {
      const jobStart = toUtc(j.scheduledStart!);
      const jobEnd = toUtc(j.scheduledEnd ?? j.scheduledStart!);
      if (jobEnd < jobStart) continue;
      const overlapStart = Math.max(jobStart, weekStart);
      const overlapEnd = Math.min(jobEnd, weekEnd);
      if (overlapEnd < overlapStart) continue;

      const jobDays = (jobEnd - jobStart) / DAY_MS + 1;
      const overlapDays = (overlapEnd - overlapStart) / DAY_MS + 1;
      const totalHours =
        j.estimatedHours && j.estimatedHours > 0
          ? j.estimatedHours
          : jobDays * FALLBACK_HOURS_PER_DAY;
      const hours = (totalHours / jobDays) * overlapDays;

      if (!j.assignedSubId) {
        unassignedHours += hours;
        continue;
      }
      let crew = crews.get(j.assignedSubId);
      if (!crew) {
        // Inactive crew that still has scheduled work — show it anyway.
        const s = subsById.get(j.assignedSubId);
        crew = {
          subId: j.assignedSubId,
          subName: s?.name ?? "Unknown crew",
          color: s?.color,
          hours: 0,
          capacityHours:
            s?.weeklyCapacityHours ?? DEFAULT_WEEKLY_CAPACITY_HOURS,
          jobs: [],
        };
        crews.set(j.assignedSubId, crew);
      }
      crew.hours += hours;
      crew.jobs.push({
        id: j.id,
        name: j.name || j.customerName || "Job",
        hours,
      });
    }

    const crewList = [...crews.values()].sort((a, b) =>
      a.subName.localeCompare(b.subName),
    );
    weeks.push({
      start: toIso(weekStart),
      end: toIso(weekEnd),
      crews: crewList,
      unassignedHours,
      totalHours:
        crewList.reduce((n, c) => n + c.hours, 0) + unassignedHours,
      totalCapacity: crewList.reduce((n, c) => n + c.capacityHours, 0),
    });
  }
  return weeks;
}
