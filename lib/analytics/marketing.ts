import "server-only";

import { MarketingSpendRepo } from "@/lib/airtable/marketing-spend";
import { OpportunitiesRepo } from "@/lib/airtable/opportunities";
import type {
  MarketingMonthRow,
  MarketingReport,
  MarketingSourceTotal,
  SourceSignal,
} from "@/lib/airtable/types";

const monthOf = (s?: string) => (s ? s.slice(0, 7) : "");

/**
 * ROAS bands for the keep-spending signal. Break-even ROAS ≈ 1 ÷ gross margin:
 * at this business's ~40% GP a dollar of ad spend needs $2.50 of revenue to
 * break even, and $5 (2× break-even) to be comfortably worth scaling.
 */
const BREAK_EVEN_ROAS = 2.5;
const PROFITABLE_ROAS = 5;

function signalFor(spend: number, revenue: number): SourceSignal {
  if (spend <= 0) return "no-spend";
  const roas = revenue / spend;
  if (roas >= PROFITABLE_ROAS) return "profitable";
  if (roas >= BREAK_EVEN_ROAS) return "marginal";
  return "unprofitable";
}

/**
 * The marketing grid: source × lead-cohort-month, spend and funnel outcomes in
 * one row. Cohort attribution — every stage and every dollar of won revenue is
 * credited to the month the LEAD was created, so a month's ad spend lines up
 * against everything that month's leads eventually produced, whenever it
 * closed. (Consequence: recent cohorts always look weak until their pending
 * proposals decide — the `pending` count says how much is still in flight.)
 */
export async function marketingReport(
  from?: string,
  to?: string,
): Promise<MarketingReport> {
  const [opps, spendRows] = await Promise.all([
    OpportunitiesRepo.list(),
    MarketingSpendRepo.list(),
  ]);

  const grid = new Map<string, MarketingMonthRow>();
  const cell = (source: string, month: string): MarketingMonthRow => {
    const key = `${source}|${month}`;
    let c = grid.get(key);
    if (!c) {
      c = {
        source,
        month,
        spend: 0,
        leads: 0,
        appts: 0,
        proposals: 0,
        wins: 0,
        pending: 0,
        revenue: 0,
      };
      grid.set(key, c);
    }
    return c;
  };
  const inRange = (month: string) =>
    Boolean(month) && (!from || month >= from) && (!to || month <= to);

  for (const o of opps) {
    const month = monthOf(o.leadCreatedAt) || monthOf(o.createdTime);
    if (!inRange(month)) continue;
    const c = cell(o.source || "Unknown", month);
    // Stages nest, same as the funnel: a win implies a proposal and an appt.
    const won = o.saleOutcome === "Won";
    const proposal = won || Boolean(o.proposalSent) || Boolean(o.proposalSentDate);
    const appt =
      proposal ||
      Boolean(o.bookedAt) ||
      Boolean(o.appointmentAt) ||
      o.setterStatus === "Booked";
    c.leads++;
    if (appt) c.appts++;
    if (proposal) c.proposals++;
    if (won) {
      c.wins++;
      c.revenue += o.wonAmount ?? o.proposalAmount ?? 0;
    } else if (proposal && o.saleOutcome !== "Lost") {
      c.pending++;
    }
  }

  for (const s of spendRows) {
    if (!inRange(s.month)) continue;
    cell(s.source, s.month).spend += s.amount;
  }

  const months = [...grid.values()].sort(
    (a, b) => a.source.localeCompare(b.source) || a.month.localeCompare(b.month),
  );

  // Roll each source up over the range and derive the economics.
  const bySource = new Map<string, MarketingMonthRow[]>();
  months.forEach((m) => {
    (bySource.get(m.source) || bySource.set(m.source, []).get(m.source)!).push(m);
  });
  const sources: MarketingSourceTotal[] = [...bySource.entries()]
    .map(([source, rows]) => {
      const sum = (k: "spend" | "leads" | "appts" | "proposals" | "wins" | "pending" | "revenue") =>
        rows.reduce((s, r) => s + r[k], 0);
      const spend = sum("spend");
      const leads = sum("leads");
      const wins = sum("wins");
      const revenue = sum("revenue");
      return {
        source,
        spend,
        leads,
        appts: sum("appts"),
        proposals: sum("proposals"),
        wins,
        pending: sum("pending"),
        revenue,
        costPerLead: spend > 0 && leads > 0 ? spend / leads : null,
        costPerWin: spend > 0 && wins > 0 ? spend / wins : null,
        roas: spend > 0 ? revenue / spend : null,
        closeRate: leads > 0 ? Math.round((wins / leads) * 100) : 0,
        signal: signalFor(spend, revenue),
      };
    })
    // Money at stake first: paid sources by spend, then free sources by revenue.
    .sort((a, b) => b.spend - a.spend || b.revenue - a.revenue);

  const paidSources = sources.filter((s) => s.spend > 0);
  const paidSpend = paidSources.reduce((s, r) => s + r.spend, 0);
  const paidRevenue = paidSources.reduce((s, r) => s + r.revenue, 0);
  const paidLeads = paidSources.reduce((s, r) => s + r.leads, 0);

  return {
    from: from ?? null,
    to: to ?? null,
    months,
    sources,
    paid: {
      spend: paidSpend,
      revenue: paidRevenue,
      roas: paidSpend > 0 ? paidRevenue / paidSpend : null,
      costPerLead: paidSpend > 0 && paidLeads > 0 ? paidSpend / paidLeads : null,
    },
  };
}
