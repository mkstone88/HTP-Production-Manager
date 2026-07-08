/**
 * Follow-up cadence. A brand-new lead is due IMMEDIATELY (speed-to-lead: contact
 * rates collapse within the first hour), then each logged contact schedules the
 * next touch relative to NOW — not the lead's creation date — so working an old
 * lead actually clears it from the "due" pile until its next touch.
 *
 * A customer-requested callback (Callback At) overrides the cadence entirely:
 * the lead sleeps until that moment, then surfaces at the top of the queue.
 *
 * Pure module (no server-only) — usable on client and server.
 */

const DAY_MS = 86_400_000;

/**
 * Days to wait AFTER each logged contact before the next touch is due.
 * GAP_DAYS[attempts - 1] = wait after the Nth touch. Pacing preserved from the
 * original day-offset schedule (touches on days 0,1,2,3,5,7,10 of a lead's life
 * when worked on time). After the final gap the cadence is exhausted — the lead
 * needs a decision (book / disqualify / abandon), not another silent retry.
 */
export const GAP_DAYS = [1, 1, 1, 2, 2, 3] as const;

/** Max touches before the cadence is exhausted and a decision is due. */
export const MAX_ATTEMPTS = GAP_DAYS.length;

/**
 * The next follow-up datetime (ISO) after a touch has just been logged.
 * `attempts` is the NEW total (including the touch being logged). Anchored to
 * `fromISO` (defaults to now). Returns null once the cadence is exhausted.
 */
export function computeNextFollowUp(
  attempts: number,
  fromISO?: string,
): string | null {
  if (attempts <= 0) return new Date().toISOString(); // never touched → due now
  if (attempts > MAX_ATTEMPTS) return null;
  const base = fromISO ? Date.parse(fromISO) : Date.now();
  const anchor = Number.isNaN(base) ? Date.now() : base;
  return new Date(anchor + GAP_DAYS[attempts - 1] * DAY_MS).toISOString();
}

/** Whole days since an ISO timestamp, or null if unparseable/empty. */
export function daysSince(iso: string | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / DAY_MS);
}

/** Whether an ISO timestamp is now or in the past (empty/invalid → true). */
export function isDue(iso: string | undefined): boolean {
  if (!iso) return true;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return true;
  return t <= Date.now();
}

/**
 * Where a lead stands in the queue. Determines both sort rank and the chip the
 * setter sees. Ordering: new (never touched, call NOW) → callback (customer
 * asked for this time and it has arrived) → decision (cadence exhausted — stop
 * retrying, decide) → due (next touch due) → waiting (nothing due yet).
 */
export type QueueState = "new" | "callback" | "decision" | "due" | "waiting";

export function queueState(lead: {
  contactAttempts: number;
  firstContactedAt?: string;
  callbackAt?: string;
  nextFollowUpDate?: string;
}): QueueState {
  if (lead.contactAttempts <= 0 && !lead.firstContactedAt) return "new";
  if (lead.callbackAt) return isDue(lead.callbackAt) ? "callback" : "waiting";
  if (lead.contactAttempts >= MAX_ATTEMPTS) return "decision";
  return isDue(lead.nextFollowUpDate) ? "due" : "waiting";
}
