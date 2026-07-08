import "server-only";

import { OpportunitiesRepo } from "@/lib/airtable/opportunities";
import type { Opportunity, SalesRow } from "@/lib/airtable/types";

/**
 * Normalize a raw city string to a stable display value so grouping by city
 * doesn't scatter across casing/whitespace variants of the same place.
 */
function normCity(raw: string): string {
  const c = (raw || "").trim();
  if (!c) return "Unknown";
  const t = c
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  if (t === "Okc" || t === "Oklahoma City," || t === "Oklahoma") return "Oklahoma City";
  return t;
}

/**
 * Evidence that a proposal actually went out. Win rate's denominator is exactly
 * these rows — a Won, or any Lost/Pending row carrying proposal evidence (an
 * amount, a sent date, or the Proposal Sent flag). Lost rows with no proposal
 * evidence are lead-funnel losses, not lost proposals, and are excluded.
 */
function proposalSent(o: Opportunity): boolean {
  return (
    o.saleOutcome === "Won" ||
    Boolean(o.proposalSent) ||
    Boolean(o.proposalSentDate) ||
    (o.proposalAmount ?? 0) > 0
  );
}

/**
 * Every proposal actually sent, with its outcome. Win rate = won ÷ all of these,
 * so a Pending proposal counts against the rate until it converts (and the rate
 * creeps up as pendings become Won — the "living close rate" the owner wants).
 *
 * Attribution is anchored on Lead Created At (lead-cohort mode): it's populated
 * on every row and consistent for wins and losses. Proposal Sent Date is often
 * empty and Date of Sale is corrupt on some imported rows, so both scatter the
 * time buckets.
 */
export async function listSalesRows(): Promise<SalesRow[]> {
  const opps = await OpportunitiesRepo.list();

  // Only decided proposals with evidence they were sent.
  const decided = opps.filter(
    (o) =>
      o.saleOutcome === "Won" ||
      o.saleOutcome === "Lost" ||
      o.saleOutcome === "Pending",
  );
  const sent = decided.filter(proposalSent);

  const contactIds = sent
    .map((o) => o.contactId)
    .filter((v): v is string => Boolean(v));
  const cityById = contactIds.length
    ? await OpportunitiesRepo.citiesByContactIds(contactIds)
    : new Map<string, string>();

  return sent.map((o) => {
    const dateStr =
      o.leadCreatedAt || o.proposalSentDate || o.dateOfSale || o.createdTime || "";
    return {
      id: o.id,
      name: o.name || "(unnamed)",
      won: o.saleOutcome === "Won",
      pending: o.saleOutcome === "Pending",
      jobType: o.jobType || "Unknown",
      source: o.source || "Unknown",
      amount: o.proposalAmount ?? 0,
      city: normCity(o.contactId ? cityById.get(o.contactId) || "" : ""),
      period: dateStr ? dateStr.slice(0, 7) : "",
      date: dateStr ? dateStr.slice(0, 10) : "",
      sentDate: (o.proposalSentDate || "").slice(0, 10),
      acceptedDate: (o.dateOfSale || "").slice(0, 10),
    };
  });
}
