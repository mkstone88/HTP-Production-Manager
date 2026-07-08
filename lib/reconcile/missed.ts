// Missed-leads sweep: compare GHL opportunities against Airtable so no real lead
// slips through. Read-only — it reports gaps, writes nothing.
import "server-only";

import { OpportunitiesRepo } from "@/lib/airtable/opportunities";
import type { ReconcileGap, ReconcileResult } from "@/lib/airtable/types";
import { opportunitiesSince } from "@/lib/ghl";

/**
 * Reconcile the last `windowDays` of GHL opportunities against Airtable.
 *
 * An Airtable opportunity "represents" a lead if its GHL Opportunity ID matches,
 * OR its Match Email (stamped by the intake Zaps) OR its linked Contact's email
 * matches the GHL contact email. We check all three: Zap-created rows carry Match
 * Email but blank Contact-email lookups; historical imports are the reverse.
 * Checking only one throws false positives. A GHL opportunity that matches none
 * is a real lead that never made it across.
 */
export async function reconcileMissed(windowDays = 7): Promise<ReconcileResult> {
  const sinceMs = Date.now() - windowDays * 86_400_000;

  const [ghl, opps] = await Promise.all([
    opportunitiesSince(sinceMs),
    OpportunitiesRepo.list(),
  ]);

  const knownOppIds = new Set<string>();
  const knownEmails = new Set<string>();
  const addEmail = (v: string | undefined) => {
    const s = (v ?? "").trim().toLowerCase();
    if (s) knownEmails.add(s);
  };
  for (const o of opps) {
    if (o.ghlOpportunityId) knownOppIds.add(o.ghlOpportunityId.trim());
    addEmail(o.matchEmail);
    addEmail(o.emailFromContact);
  }

  const gaps: ReconcileGap[] = [];
  let matched = 0;

  for (const o of ghl) {
    if (o.id && knownOppIds.has(o.id)) {
      matched++;
      continue;
    }
    const email = o.email.toLowerCase();
    if (email && knownEmails.has(email)) {
      matched++;
      continue;
    }
    gaps.push({
      ghlId: o.id,
      name: o.contactName || o.name,
      email: o.email,
      phone: o.phone,
      source: o.source,
      status: o.status,
      createdAt: o.createdAt,
      reason: email ? "not-in-airtable" : "no-email-to-match",
    });
  }

  return {
    ranAt: new Date().toISOString(),
    windowDays,
    ghlChecked: ghl.length,
    matched,
    gaps,
  };
}
