import type { Job } from "@/lib/airtable/types";

/** Hometown Painting operates out of Oklahoma City. */
export const BUSINESS_TIME_ZONE = "America/Chicago";

/**
 * Today's date (YYYY-MM-DD) in the business time zone. `new Date()
 * .toISOString()` is UTC, which is already "tomorrow" during OKC evenings and
 * skews daysUntilStart / overdue badges by a day.
 */
export function todayInBusinessTz(): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
  }).format(new Date());
}

/**
 * Per-job staging readiness for the Triage tab.
 *
 * Each step is either a checkbox value the user toggles directly on the Job
 * record, or a state derived from another field (crew assigned / scheduled).
 * The "stale" projection is what the API returns and the agent will eventually
 * call as a tool — server-computed, not in components.
 */
export type StagingFlags = {
  emailSent: boolean;
  customerReplied: boolean;
  colorsReceived: boolean;
  workOrderReady: boolean;
  crewAssigned: boolean;
  scheduled: boolean;
};

export type StagingSummary = StagingFlags & {
  /** Number of steps complete out of total. */
  done: number;
  total: number;
  /** True when every step is complete. */
  ready: boolean;
  /**
   * Optional flag set to true when the job has a near-term start date but is
   * still missing one or more pre-job steps. UI uses this for an "attention"
   * badge.
   */
  needsAttention: boolean;
  /** Days from `today` until the scheduled start (negative = past). Undefined if unscheduled. */
  daysUntilStart?: number;
  /** Days since the proposal was accepted (Job Won Date). Undefined if unknown. */
  ageDays?: number;
};

const STEP_KEYS: (keyof StagingFlags)[] = [
  "emailSent",
  "customerReplied",
  "colorsReceived",
  "workOrderReady",
  "crewAssigned",
  "scheduled",
];

/**
 * Days between two YYYY-MM-DD strings, ignoring time. Negative when `to` is
 * before `from`. Computed in UTC to avoid DST nudges.
 */
function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.UTC(
    Number(fromIso.slice(0, 4)),
    Number(fromIso.slice(5, 7)) - 1,
    Number(fromIso.slice(8, 10)),
  );
  const b = Date.UTC(
    Number(toIso.slice(0, 4)),
    Number(toIso.slice(5, 7)) - 1,
    Number(toIso.slice(8, 10)),
  );
  return Math.round((b - a) / 86_400_000);
}

export function computeStaging(
  job: Job,
  opts: { today: string; attentionWithinDays?: number } = {
    today: todayInBusinessTz(),
  },
): StagingSummary {
  const flags: StagingFlags = {
    emailSent: Boolean(job.emailSent),
    customerReplied: Boolean(job.customerReplied),
    colorsReceived: Boolean(job.colorsReceived),
    workOrderReady: Boolean(job.workOrderReady),
    crewAssigned: Boolean(job.assignedSubId),
    scheduled: Boolean(job.scheduledStart),
  };
  const done = STEP_KEYS.reduce((n, k) => n + (flags[k] ? 1 : 0), 0);
  const total = STEP_KEYS.length;
  const daysUntilStart = job.scheduledStart
    ? daysBetween(opts.today, job.scheduledStart)
    : undefined;
  const ageDays = job.jobWonDate
    ? daysBetween(job.jobWonDate, opts.today)
    : undefined;
  const within = opts.attentionWithinDays ?? 14;
  const needsAttention =
    daysUntilStart !== undefined && daysUntilStart <= within && done < total;
  return {
    ...flags,
    done,
    total,
    ready: done === total,
    needsAttention,
    daysUntilStart,
    ageDays,
  };
}
