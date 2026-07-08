/**
 * Follow-up cadence. A lead should be touched on these days after it arrives
 * until it's worked to an outcome. The queue surfaces leads whose next touch is
 * due, so nobody gets forgotten.
 *
 * Pure module (no server-only) — usable on client and server.
 */

const DAY_MS = 86_400_000;

/** Days after Lead Created At to touch the lead (attempt 0 = first touch). */
export const FOLLOWUP_OFFSET_DAYS = [1, 2, 3, 5, 7, 10] as const;

/**
 * The next follow-up datetime (ISO) given when the lead arrived and how many
 * touches have happened. Returns null once the cadence is exhausted — at that
 * point the lead is overdue for a decision (book / disqualify / abandon).
 */
export function computeNextFollowUp(
  createdAtISO: string | undefined,
  attempts: number,
): string | null {
  if (attempts < 0) attempts = 0;
  if (attempts >= FOLLOWUP_OFFSET_DAYS.length) return null;
  const base = createdAtISO ? Date.parse(createdAtISO) : Date.now();
  const anchor = Number.isNaN(base) ? Date.now() : base;
  return new Date(anchor + FOLLOWUP_OFFSET_DAYS[attempts] * DAY_MS).toISOString();
}

/** Whole days since an ISO timestamp, or null if unparseable/empty. */
export function daysSince(iso: string | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / DAY_MS);
}

/**
 * Whether a lead is due for a follow-up now. A missing next-follow-up date means
 * cadence was never set (legacy / just needs attention) → treat as due.
 */
export function isOverdue(nextFollowUpISO: string | undefined): boolean {
  if (!nextFollowUpISO) return true;
  const t = Date.parse(nextFollowUpISO);
  if (Number.isNaN(t)) return true;
  return t <= Date.now();
}
