"use client";

import { useQuery } from "@tanstack/react-query";
import {
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { AlertTriangle, ArrowRight, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { JobCostingEditor } from "@/components/costing/job-costing-editor";
import { Modal } from "@/components/costing/modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Job } from "@/lib/airtable/types";
import type { CostingKpis } from "@/lib/costing/dashboard";
import { formatCurrency, formatPercent } from "@/lib/costing/format";
import { cn } from "@/lib/utils";

type DashboardData = {
  kpis: CostingKpis;
  needsFinalizing: Job[];
  costed: Job[];
  unassignedInvoiceCount: number;
};

type Range = { from?: string; to?: string };

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

function periodRanges(): { key: string; label: string; range: Range }[] {
  const now = new Date();
  return [
    { key: "all", label: "All time", range: {} },
    {
      key: "thisWeek",
      label: "This week",
      range: { from: fmt(startOfWeek(now)), to: fmt(endOfWeek(now)) },
    },
    {
      key: "lastWeek",
      label: "Last week",
      range: {
        from: fmt(startOfWeek(subWeeks(now, 1))),
        to: fmt(endOfWeek(subWeeks(now, 1))),
      },
    },
    {
      key: "thisMonth",
      label: "This month",
      range: { from: fmt(startOfMonth(now)), to: fmt(endOfMonth(now)) },
    },
    {
      key: "lastMonth",
      label: "Last month",
      range: {
        from: fmt(startOfMonth(subMonths(now, 1))),
        to: fmt(endOfMonth(subMonths(now, 1))),
      },
    },
  ];
}

async function fetchDashboard(range: Range): Promise<DashboardData> {
  const params = new URLSearchParams();
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  const qs = params.toString();
  const res = await fetch(`/api/costing/dashboard${qs ? `?${qs}` : ""}`, {
    cache: "no-store",
  });
  const data = (await res.json()) as DashboardData & { error?: string };
  if (!res.ok || !data.kpis) throw new Error(data.error || "Failed to load dashboard");
  return data;
}

export function CostingDashboard() {
  const periods = useMemo(() => periodRanges(), []);
  const [periodKey, setPeriodKey] = useState("thisMonth");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Job | null>(null);

  const range = periods.find((p) => p.key === periodKey)?.range ?? {};
  const q = useQuery({
    queryKey: ["costing", "dashboard", range],
    queryFn: () => fetchDashboard(range),
  });

  const data = q.data;
  const filteredCosted = useMemo(() => {
    const list = data?.costed ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter((j) =>
      [j.name, j.customerName, j.address]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(term)),
    );
  }, [data?.costed, search]);

  return (
    <div className="flex flex-1 flex-col bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <h1 className="text-2xl font-bold tracking-tight">Job costing</h1>
        <Link href="/costing/invoices" className="ml-auto">
          <Button size="sm" variant="outline" className="h-10 px-3 sm:h-9">
            Invoices
          </Button>
        </Link>
      </div>

      <div className="space-y-6 p-4">
        {q.isLoading && (
          <div className="text-sm text-muted-foreground">Loading…</div>
        )}
        {q.error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {q.error instanceof Error ? q.error.message : "Failed to load."}
          </div>
        )}

        {data && (
          <>
            {/* Section 1: KPIs */}
            <section className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {periods.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPeriodKey(p.key)}
                    className={cn(
                      "h-8 rounded-md px-3 text-sm font-medium transition-colors",
                      periodKey === p.key
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted/60",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Kpi label="Avg gross profit %" value={formatPercent(data.kpis.avgGrossProfitPct)} />
                <Kpi label="Total gross profit" value={formatCurrency(data.kpis.totalGrossProfit)} />
                <Kpi label="Revenue" value={formatCurrency(data.kpis.totalRevenue)} />
                <Kpi label="Jobs costed" value={String(data.kpis.jobCount)} />
              </div>
              {(data.kpis.laborOverageCount > 0 || data.kpis.materialsOverageCount > 0) && (
                <p className="text-xs text-muted-foreground">
                  {data.kpis.laborOverageCount} labor overage
                  {data.kpis.laborOverageCount === 1 ? "" : "s"} ·{" "}
                  {data.kpis.materialsOverageCount} materials overage
                  {data.kpis.materialsOverageCount === 1 ? "" : "s"} in this period.
                </p>
              )}
            </section>

            {/* Section 2: Needs finalizing */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">
                  Needs finalizing{" "}
                  <span className="text-muted-foreground">
                    ({data.needsFinalizing.length})
                  </span>
                </h2>
                {data.needsFinalizing.length > 0 && (
                  <Link href="/costing/jobs" className="ml-auto">
                    <Button size="sm" variant="outline">
                      Go to job costing
                      <ArrowRight className="size-4" />
                    </Button>
                  </Link>
                )}
              </div>
              {data.unassignedInvoiceCount > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    {data.unassignedInvoiceCount} unassigned invoice
                    {data.unassignedInvoiceCount === 1 ? "" : "s"} — assign before finalizing.{" "}
                    <Link href="/costing/invoices" className="font-medium underline">
                      Invoices
                    </Link>
                  </span>
                </div>
              )}
              {data.needsFinalizing.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing waiting. All completed jobs are costed.
                </p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {data.needsFinalizing.slice(0, 6).map((j) => (
                    <li key={j.id} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">
                          {j.name || j.customerName || "Job"}
                        </div>
                        <div className="truncate text-sm text-muted-foreground">
                          {j.scheduledEnd ? `Completed ${j.scheduledEnd}` : "—"}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Section 3: Already costed */}
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">Costed jobs</h2>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search costed jobs…"
                  className="pl-9"
                />
              </div>
              {filteredCosted.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No costed jobs in this period.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Job</th>
                        <th className="px-3 py-2 text-right font-medium">Gross profit</th>
                        <th className="px-3 py-2 text-right font-medium">GP %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredCosted.map((j) => (
                        <tr
                          key={j.id}
                          onClick={() => setEditing(j)}
                          className="cursor-pointer transition-colors hover:bg-muted/40"
                        >
                          <td className="px-3 py-2">
                            <div className="font-medium">
                              {j.name || j.customerName || "Job"}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              {j.scheduledEnd || "—"}
                              {(j.laborOverage ?? 0) > 0 && (
                                <span className="rounded bg-amber-100 px-1 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
                                  labor over
                                </span>
                              )}
                              {(j.materialsOverage ?? 0) > 0 && (
                                <span className="rounded bg-amber-100 px-1 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
                                  materials over
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatCurrency(j.grossProfit)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatPercent(j.grossProfitPct)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {editing && (
        <Modal
          title={editing.name || editing.customerName || "Job"}
          subtitle={[editing.customerName, editing.address].filter(Boolean).join(" · ") || undefined}
          onClose={() => setEditing(null)}
        >
          <JobCostingEditor key={editing.id} job={editing} onDone={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
