import type { Job } from "@/lib/airtable/types";

/**
 * Business-level costing KPIs, computed server-side over a set of finalized jobs
 * (per the repo's rule: aggregation logic lives behind the API, not in components).
 */
export type CostingKpis = {
  jobCount: number;
  totalRevenue: number;
  totalGrossProfit: number;
  /** Simple average of each job's Gross Profit % (only jobs that report one). */
  avgGrossProfitPct: number | null;
  /** Count of jobs that ran over on labor / materials vs. estimate. */
  laborOverageCount: number;
  materialsOverageCount: number;
};

export function computeKpis(jobs: Job[]): CostingKpis {
  const totalRevenue = jobs.reduce((n, j) => n + (j.projectAmount ?? 0), 0);
  const totalGrossProfit = jobs.reduce((n, j) => n + (j.grossProfit ?? 0), 0);
  const withPct = jobs.filter((j) => typeof j.grossProfitPct === "number");
  const avgGrossProfitPct =
    withPct.length > 0
      ? withPct.reduce((n, j) => n + (j.grossProfitPct ?? 0), 0) / withPct.length
      : null;
  const laborOverageCount = jobs.filter((j) => (j.laborOverage ?? 0) > 0).length;
  const materialsOverageCount = jobs.filter((j) => (j.materialsOverage ?? 0) > 0).length;
  return {
    jobCount: jobs.length,
    totalRevenue,
    totalGrossProfit,
    avgGrossProfitPct,
    laborOverageCount,
    materialsOverageCount,
  };
}

/**
 * Keep only jobs whose completion date falls inside [from, to] (inclusive,
 * YYYY-MM-DD). A missing bound is open-ended. Jobs with no completion date are
 * kept only when no range is supplied at all.
 */
export function filterByCompletionDate(
  jobs: Job[],
  from?: string,
  to?: string,
): Job[] {
  if (!from && !to) return jobs;
  return jobs.filter((j) => {
    const d = j.scheduledEnd; // "Job Complete Date"
    if (!d) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}
