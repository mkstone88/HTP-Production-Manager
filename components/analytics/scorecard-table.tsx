"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { Card } from "@/components/ui/card";
import type { WeekRow } from "@/lib/airtable/types";
import { cn } from "@/lib/utils";

const money = (n: number) => (n ? `$${Math.round(n).toLocaleString()}` : "—");

async function fetchScorecard(): Promise<WeekRow[]> {
  const res = await fetch("/api/scorecard?weeks=26", { cache: "no-store" });
  const data = (await res.json()) as { rows?: WeekRow[]; error?: string };
  if (!res.ok || !data.rows) throw new Error(data.error || "Failed to load scorecard");
  return data.rows;
}

export function ScorecardTable() {
  const query = useQuery({ queryKey: ["scorecard"], queryFn: fetchScorecard });
  const rows = useMemo(() => query.data ?? [], [query.data]);

  const hasGoals = rows.some((r) => r.goals);
  const year = new Date().getFullYear();
  const ytd = rows
    .filter((r) => r.weekStart >= `${year}-01-01`)
    .reduce(
      (a, r) => ({
        leads: a.leads + r.leads,
        appts: a.appts + r.appts,
        jobsSold: a.jobsSold + r.jobsSold,
        dollarsSold: a.dollarsSold + r.dollarsSold,
        invoiced: a.invoiced + r.invoiced,
        collected: a.collected + r.collected,
      }),
      { leads: 0, appts: 0, jobsSold: 0, dollarsSold: 0, invoiced: 0, collected: 0 },
    );

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Weekly scorecard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Week-of-activity view (Mon–Sun): leads that arrived, appointments run, jobs
          and dollars sold, revenue invoiced, and cash collected — each in the week it
          actually happened.
        </p>
      </div>

      {query.isLoading && (
        <p className="text-sm text-muted-foreground">Computing the scorecard…</p>
      )}
      {query.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {query.error instanceof Error ? query.error.message : "Failed to load scorecard."}
        </div>
      )}

      {!query.isLoading && !query.error && (
        <>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">Week</th>
                  <Th>Leads</Th>
                  <Th>Appts run</Th>
                  <Th>Jobs sold</Th>
                  <Th>$ Sold</Th>
                  <Th>$ Invoiced</Th>
                  <Th>$ Collected</Th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t bg-muted/40">
                  <td className="whitespace-nowrap px-4 py-2.5 font-bold">
                    {year} YTD
                  </td>
                  <Cell bold v={ytd.leads} />
                  <Cell bold v={ytd.appts} />
                  <Cell bold v={ytd.jobsSold} />
                  <Cell bold v={money(ytd.dollarsSold)} />
                  <Cell bold v={money(ytd.invoiced)} />
                  <Cell bold v={money(ytd.collected)} />
                </tr>
                {rows.map((r) => (
                  <tr key={r.weekStart} className="border-t">
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium text-muted-foreground">
                      {r.label}
                    </td>
                    <Cell v={r.leads} goal={r.goals?.leads} />
                    <Cell v={r.appts} goal={r.goals?.appts} />
                    <Cell v={r.jobsSold} goal={r.goals?.jobsSold} />
                    <Cell v={money(r.dollarsSold)} raw={r.dollarsSold} goal={r.goals?.dollarsSold} />
                    <Cell v={money(r.invoiced)} raw={r.invoiced} goal={r.goals?.invoiced} />
                    <Cell v={money(r.collected)} />
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="max-w-[80ch] text-xs text-muted-foreground">
            Sold uses the real acceptance date; Invoiced/Collected come from PaintScout
            invoices and payments. Appointments only count where an appointment time was
            recorded — sparse historically, accurate once the booking workflow writes it.
            Hours Produced and actual GP% aren’t tracked digitally yet (production layer —
            future).
            {!hasGoals &&
              " To show goals beside actuals, create a “NEW - Weekly Goals” table (Week Start date + Leads/Appointments/Jobs Sold/Dollars Sold/Invoiced Goal numbers)."}
          </p>
        </>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">{children}</th>
  );
}

function Cell({
  v,
  raw,
  goal,
  bold,
}: {
  v: number | string;
  raw?: number;
  goal?: number;
  bold?: boolean;
}) {
  const actual = typeof raw === "number" ? raw : typeof v === "number" ? v : null;
  const tone =
    goal && actual != null
      ? actual >= goal
        ? "text-success"
        : "text-warning"
      : bold
        ? "text-foreground"
        : "text-muted-foreground";
  return (
    <td
      className={cn(
        "whitespace-nowrap px-3 py-2.5 text-right font-mono",
        bold && "font-semibold",
        tone,
      )}
    >
      {v}
      {goal ? (
        <span className="text-xs font-normal text-muted-foreground">
          {" "}
          /{goal >= 1000 ? `$${Math.round(goal / 1000)}k` : goal}
        </span>
      ) : null}
    </td>
  );
}
