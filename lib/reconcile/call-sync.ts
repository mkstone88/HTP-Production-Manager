// Call-sync sweep: find outbound GHL calls on queue leads that nobody clicked
// "Mark contacted" for, and log them as cadence touches. This is what lets the
// follow-up sequence stay accurate even when the setter works entirely inside
// GoHighLevel — the manual button becomes a way to add context (notes,
// callbacks), not a chore the cadence depends on.
import "server-only";

import { LeadsRepo } from "@/lib/airtable/leads";
import type { CallSyncResult } from "@/lib/airtable/types";
import { latestOutboundCallAt } from "@/lib/ghl";

const HOUR_MS = 3_600_000;

/**
 * Calls within this many hours of the last logged touch count as the SAME
 * working session (a redial after a voicemail), not a new cadence touch —
 * otherwise one persistent afternoon would burn several cadence steps at once.
 */
const SAME_SESSION_MS = 20 * HOUR_MS;

/** How far back to look for unlogged calls on a lead that has no touches yet. */
const LOOKBACK_MS = 7 * 24 * HOUR_MS;

export async function syncCalls(by = "call-sync-cron"): Promise<CallSyncResult> {
  const leads = await LeadsRepo.listQueue();

  let synced = 0;
  let skippedNoGhlId = 0;
  let skippedNoNewCall = 0;
  let skippedGuarded = 0;

  // Sequential on purpose: keeps us far under both GHL and Airtable rate
  // limits, and the queue is small (tens of leads).
  for (const lead of leads) {
    if (!lead.ghlContactId) {
      skippedNoGhlId++;
      continue;
    }

    const lastTouchMs = lead.lastContactedAt
      ? Date.parse(lead.lastContactedAt)
      : NaN;
    const floor = Math.max(
      Number.isNaN(lastTouchMs) ? 0 : lastTouchMs + 1,
      Date.now() - LOOKBACK_MS,
    );

    const callAt = await latestOutboundCallAt(lead.ghlContactId, floor);
    if (!callAt) {
      skippedNoNewCall++;
      continue;
    }
    const callMs = Date.parse(callAt);

    // Same working session as an already-logged touch → not a new touch.
    if (!Number.isNaN(lastTouchMs) && callMs - lastTouchMs < SAME_SESSION_MS) {
      skippedGuarded++;
      continue;
    }
    // A human acted on this lead AFTER the call (logged it, scheduled the
    // callback the customer asked for, booked...). Their action already
    // reflects the call — don't stomp it.
    const lastActionMs = lead.lastActionAt ? Date.parse(lead.lastActionAt) : NaN;
    if (!Number.isNaN(lastActionMs) && callMs <= lastActionMs) {
      skippedGuarded++;
      continue;
    }

    await LeadsRepo.syncCallTouch(lead.id, callAt, by);
    synced++;
  }

  return {
    ranAt: new Date().toISOString(),
    checked: leads.length,
    synced,
    skippedNoGhlId,
    skippedNoNewCall,
    skippedGuarded,
  };
}
