import { describe, expect, it } from "vitest";

import type { Job } from "@/lib/airtable/types";
import { computeKpis, filterByCompletionDate } from "./dashboard";

function job(overrides: Partial<Job>): Job {
  return { id: "rec", name: "j", ...overrides };
}

describe("computeKpis", () => {
  it("handles an empty set", () => {
    expect(computeKpis([])).toEqual({
      jobCount: 0,
      totalRevenue: 0,
      totalGrossProfit: 0,
      avgGrossProfitPct: null,
      laborOverageCount: 0,
      materialsOverageCount: 0,
    });
  });

  it("sums revenue/GP and averages pct only over jobs reporting one", () => {
    const kpis = computeKpis([
      job({ projectAmount: 10_000, grossProfit: 4_000, grossProfitPct: 0.4 }),
      job({ projectAmount: 6_000, grossProfit: 3_000, grossProfitPct: 0.5 }),
      job({ projectAmount: 2_000 }), // no GP% reported — excluded from avg
    ]);
    expect(kpis.jobCount).toBe(3);
    expect(kpis.totalRevenue).toBe(18_000);
    expect(kpis.totalGrossProfit).toBe(7_000);
    expect(kpis.avgGrossProfitPct).toBeCloseTo(0.45);
  });

  it("counts only positive overages", () => {
    const kpis = computeKpis([
      job({ laborOverage: 250, materialsOverage: 0 }),
      job({ laborOverage: -100, materialsOverage: 50 }),
    ]);
    expect(kpis.laborOverageCount).toBe(1);
    expect(kpis.materialsOverageCount).toBe(1);
  });
});

describe("filterByCompletionDate", () => {
  const jobs = [
    job({ id: "a", scheduledEnd: "2026-06-15" }),
    job({ id: "b", scheduledEnd: "2026-07-01" }),
    job({ id: "c" }), // no completion date
  ];

  it("returns everything (incl. undated) when no range given", () => {
    expect(filterByCompletionDate(jobs)).toHaveLength(3);
  });

  it("filters inclusively and drops undated jobs when a bound is set", () => {
    expect(filterByCompletionDate(jobs, "2026-06-15").map((j) => j.id)).toEqual(["a", "b"]);
    expect(filterByCompletionDate(jobs, undefined, "2026-06-30").map((j) => j.id)).toEqual(["a"]);
    expect(filterByCompletionDate(jobs, "2026-07-01", "2026-07-31").map((j) => j.id)).toEqual(["b"]);
  });
});
