import "server-only";

import { OpportunitiesRepo } from "@/lib/airtable/opportunities";
import type { FunnelRow } from "@/lib/airtable/types";

const monthOf = (s?: string) => (s ? s.slice(0, 7) : "");

/**
 * Every opportunity reduced to funnel stages, each tagged with the month it
 * happened. The client can then bucket two ways:
 *   - lead cohort  — everything under Lead Created At (marketing ROI).
 *   - activity     — each stage in its own event month (e.g. a proposal counts
 *                    in the month it was SENT, a win in the month it closed).
 * Stages nest (a win implies a proposal and an appointment).
 */
export async function listFunnelRows(): Promise<FunnelRow[]> {
  const opps = await OpportunitiesRepo.list();
  return opps.map((o) => {
    const won = o.saleOutcome === "Won";
    const proposal = won || Boolean(o.proposalSent) || Boolean(o.proposalSentDate);
    const appt =
      Boolean(o.bookedAt) ||
      Boolean(o.appointmentAt) ||
      o.setterStatus === "Booked" ||
      proposal ||
      won;

    const leadMonth = monthOf(o.leadCreatedAt) || monthOf(o.createdTime);
    const proposalMonth = proposal
      ? monthOf(o.proposalSentDate) || monthOf(o.dateOfSale) || leadMonth
      : "";
    const apptMonth = appt
      ? monthOf(o.appointmentAt) || monthOf(o.bookedAt) || leadMonth
      : "";
    const wonMonth = won
      ? monthOf(o.dateOfSale) || monthOf(o.proposalSentDate) || leadMonth
      : "";
    const revenue = won ? (o.wonAmount ?? o.proposalAmount ?? 0) : 0;

    return {
      source: o.source || "Unknown",
      leadMonth,
      apptMonth,
      proposalMonth,
      wonMonth,
      revenue,
      appt,
      proposal,
      won,
    };
  });
}
