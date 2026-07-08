import "server-only";

import { OpportunitiesRepo } from "@/lib/airtable/opportunities";
import type { FunnelRow } from "@/lib/airtable/types";

/**
 * Every opportunity reduced to funnel stages. Stages nest — a won job counts as
 * having had a proposal and an appointment — so Leads ≥ Appts ≥ Proposals ≥ Sold.
 * Attribution is anchored on Lead Created At (same lead-cohort mode as sales).
 */
export async function listFunnelRows(): Promise<FunnelRow[]> {
  const opps = await OpportunitiesRepo.list();
  return opps.map((o) => {
    const won = o.saleOutcome === "Won";
    const proposal = won || Boolean(o.proposalSent) || Boolean(o.proposalSentDate);
    const booked =
      Boolean(o.bookedAt) || Boolean(o.appointmentAt) || o.setterStatus === "Booked";
    const dateStr =
      o.leadCreatedAt || o.proposalSentDate || o.dateOfSale || o.createdTime || "";
    const revenue = won ? (o.wonAmount ?? o.proposalAmount ?? 0) : 0;
    return {
      source: o.source || "Unknown",
      month: dateStr ? dateStr.slice(0, 7) : "",
      appt: booked || proposal || won,
      proposal,
      won,
      revenue,
    };
  });
}
