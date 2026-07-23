// Weekly Scorecard: week-of-activity accounting (the owner's MBP sheet).
// Unlike the sales dashboard (which attributes everything to the lead's month),
// each metric here counts in the week the EVENT happened: leads that arrived,
// appointments run, jobs sold, dollars sold, revenue invoiced, cash collected.
// Weeks run Monday–Sunday, America/Chicago.
import "server-only";

import { airtable } from "@/lib/airtable/client";
import { OpportunitiesRepo } from "@/lib/airtable/opportunities";
import { tables, weeklyGoalFields } from "@/lib/airtable/mapping";
import type { WeekGoals, WeekRow } from "@/lib/airtable/types";
import { listAllInvoices } from "@/lib/paintscout";

const CENTRAL = "America/Chicago";

/** Central-time calendar date (YYYY-MM-DD) for an ISO datetime or date string. */
export function centralDate(iso: string): string {
  if (!iso) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso; // date-only fields pass through
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CENTRAL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Monday (YYYY-MM-DD) of the week containing the given date string. */
export function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay(); // 0=Sun
  dt.setUTCDate(dt.getUTCDate() - ((dow + 6) % 7));
  return dt.toISOString().slice(0, 10);
}

function weekLabel(monday: string): string {
  const [y, m, d] = monday.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (dt: Date) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(dt);
  return `${fmt(start)} – ${fmt(end)}`;
}

/** Optional goals from a "NEW - Weekly Goals" table (create it to activate). */
async function fetchGoals(): Promise<Map<string, WeekGoals>> {
  const map = new Map<string, WeekGoals>();
  try {
    const recs = await airtable.listAll(tables.weeklyGoals);
    for (const r of recs) {
      const fields = r.fields as Record<string, unknown>;
      const ws = String(fields[weeklyGoalFields.weekStart] || "").slice(0, 10);
      if (!ws) continue;
      map.set(mondayOf(ws), {
        leads: Number(fields[weeklyGoalFields.leads]) || undefined,
        appts: Number(fields[weeklyGoalFields.appts]) || undefined,
        jobsSold: Number(fields[weeklyGoalFields.jobsSold]) || undefined,
        dollarsSold: Number(fields[weeklyGoalFields.dollarsSold]) || undefined,
        invoiced: Number(fields[weeklyGoalFields.invoiced]) || undefined,
      });
    }
  } catch {
    // Table doesn't exist yet — scorecard runs actuals-only.
  }
  return map;
}

export async function weeklyScorecard(weeks = 26): Promise<WeekRow[]> {
  const [opps, invoices, goals] = await Promise.all([
    OpportunitiesRepo.list(),
    listAllInvoices().catch(() => []),
    fetchGoals(),
  ]);

  const rows = new Map<string, WeekRow>();
  const bump = (
    dateStr: string,
    key: "leads" | "appts" | "jobsSold",
    amountKey?: "dollarsSold" | "invoiced" | "collected",
    amount = 0,
  ) => {
    const cd = centralDate(dateStr);
    if (!cd) return;
    const wk = mondayOf(cd);
    let row = rows.get(wk);
    if (!row) {
      row = {
        weekStart: wk,
        label: weekLabel(wk),
        leads: 0,
        appts: 0,
        jobsSold: 0,
        dollarsSold: 0,
        invoiced: 0,
        collected: 0,
      };
      rows.set(wk, row);
    }
    if (amountKey) row[amountKey] += amount;
    else row[key]++;
  };

  for (const o of opps) {
    if (o.leadCreatedAt) bump(o.leadCreatedAt, "leads");
    if (o.appointmentAt) bump(o.appointmentAt, "appts");
    if (o.saleOutcome === "Won" && o.dateOfSale) {
      bump(o.dateOfSale, "jobsSold");
      bump(o.dateOfSale, "jobsSold", "dollarsSold", o.wonAmount ?? 0);
    }
  }
  for (const inv of invoices) {
    if (inv.createdDate) bump(inv.createdDate, "leads", "invoiced", inv.total);
    for (const p of inv.payments) bump(p.date, "leads", "collected", p.amount);
  }

  for (const [wk, row] of rows) {
    const g = goals.get(wk);
    if (g) row.goals = g;
  }

  const sorted = [...rows.values()].sort((a, b) =>
    b.weekStart.localeCompare(a.weekStart),
  );
  // Only weeks up to the current one, most recent `weeks` of them.
  const thisWeek = mondayOf(centralDate(new Date().toISOString()));
  return sorted.filter((r) => r.weekStart <= thisWeek).slice(0, weeks);
}
