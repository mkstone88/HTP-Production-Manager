"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Search, Waypoints } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { FunnelRow, SourceReviewRow } from "@/lib/airtable/types";
import { LeadSource } from "@/lib/airtable/types";
import { cn } from "@/lib/utils";

type Tab = "fix" | "funnel";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data as T;
}

export function SourcesPanel() {
  const [tab, setTab] = useState<Tab>("fix");
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <Waypoints className="size-5" /> Sources
        </h1>
      </div>
      <div role="tablist" className="flex gap-1 border-b px-2 py-2 sm:px-3">
        <TabButton active={tab === "fix"} onClick={() => setTab("fix")}>Fix sources</TabButton>
        <TabButton active={tab === "funnel"} onClick={() => setTab("funnel")}>Funnel</TabButton>
      </div>
      {tab === "fix" ? <FixTab /> : <FunnelTab />}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "h-10 rounded-md px-3 text-sm font-medium transition-colors",
        active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted/60",
      )}
    >
      {children}
    </button>
  );
}

/* ---- Fix sources --------------------------------------------------------- */

function FixTab() {
  const review = useQuery({
    queryKey: ["sources", "review"],
    queryFn: () => getJson<{ rows: SourceReviewRow[] }>("/api/sources/review"),
  });
  const rows = review.data?.rows ?? [];

  const [q, setQ] = useState("");
  const [submittedQ, setSubmittedQ] = useState("");
  const search = useQuery({
    queryKey: ["sources", "search", submittedQ],
    queryFn: () => getJson<{ rows: SourceReviewRow[] }>(`/api/sources/search?q=${encodeURIComponent(submittedQ)}`),
    enabled: submittedQ.trim().length >= 2,
  });

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Needs review */}
      <section className="space-y-3">
        <div>
          <h2 className="font-semibold">Needs review</h2>
          <p className="text-sm text-muted-foreground">
            Leads with a blank or unrecognized source. Assign the right one — tick
            “remember” to map that raw value for good and fix every other pending
            lead like it.
          </p>
        </div>
        {review.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {review.error && <ErrorBox error={review.error} />}
        {review.data && rows.length === 0 && (
          <Card className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Check className="size-4 text-success" /> Every lead has a clean source. Nothing to review.
          </Card>
        )}
        {rows.length > 0 && (
          <div className="space-y-2">
            {rows.map((r) => (
              <SourceRow key={r.id} row={r} invalidateKeys={[["sources", "review"]]} />
            ))}
          </div>
        )}
      </section>

      {/* Search any lead */}
      <section className="space-y-3">
        <div>
          <h2 className="font-semibold">Correct a specific lead</h2>
          <p className="text-sm text-muted-foreground">
            Find any lead by name or email to fix a source that was attributed wrong.
          </p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmittedQ(q);
          }}
        >
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name or email…"
              className="h-10 pl-9"
            />
          </div>
          <Button type="submit" disabled={q.trim().length < 2}>Search</Button>
        </form>
        {search.isFetching && <p className="text-sm text-muted-foreground">Searching…</p>}
        {search.error && <ErrorBox error={search.error} />}
        {submittedQ && search.data && search.data.rows.length === 0 && !search.isFetching && (
          <p className="text-sm text-muted-foreground">No leads match “{submittedQ}”.</p>
        )}
        {search.data && search.data.rows.length > 0 && (
          <div className="space-y-2">
            {search.data.rows.map((r) => (
              <SourceRow key={r.id} row={r} showCurrent invalidateKeys={[["sources", "search", submittedQ]]} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SourceRow({
  row,
  showCurrent,
  invalidateKeys,
}: {
  row: SourceReviewRow;
  showCurrent?: boolean;
  invalidateKeys: (readonly unknown[])[];
}) {
  const qc = useQueryClient();
  const [source, setSource] = useState<string>("");
  const [remember, setRemember] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/opportunities/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setSource", source, remember }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed");
      return data as { applied: number };
    },
    onSuccess: (data) => {
      setNote(
        data.applied > 0
          ? `Saved · also fixed ${data.applied} matching lead${data.applied === 1 ? "" : "s"}`
          : "Saved",
      );
      invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      qc.invalidateQueries({ queryKey: ["leads", "queue"] });
    },
    onError: (e) => setNote(e instanceof Error ? e.message : "Save failed"),
  });

  return (
    <Card className="flex flex-wrap items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <div className="font-medium">{row.name}</div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {row.email && <span>{row.email}</span>}
          {row.createdAt && <span>· {row.createdAt.slice(0, 10)}</span>}
          {row.rawSource ? (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{row.rawSource}</code>
          ) : (
            <span className="italic">— blank raw —</span>
          )}
          {showCurrent && (
            <span>
              · now:{" "}
              <span className={cn(row.source === "Needs Review" && "text-warning")}>
                {row.source || "—"}
              </span>
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">Set source…</option>
          {LeadSource.options.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {row.rawSource && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-3.5" />
            Remember
          </label>
        )}
        <Button size="sm" disabled={!source || save.isPending} onClick={() => { setNote(null); save.mutate(); }}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
      {note && <div className="w-full text-xs text-success">{note}</div>}
    </Card>
  );
}

/* ---- Funnel -------------------------------------------------------------- */

const money = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`);
const pct = (num: number, den: number) => (den ? `${Math.round((num / den) * 100)}%` : "—");

interface Agg { leads: number; appts: number; proposals: number; sold: number; revenue: number }
const emptyAgg = (): Agg => ({ leads: 0, appts: 0, proposals: 0, sold: 0, revenue: 0 });

type Basis = "activity" | "cohort";

/**
 * Accumulate one funnel row into month buckets. In "activity" mode each stage
 * lands in the month it actually happened (a proposal in the month it was SENT,
 * a win in the month it CLOSED). In "cohort" mode every stage is credited to the
 * lead's created month — marketing ROI for a lead vintage.
 */
function bump(map: Map<string, Agg>, month: string, apply: (a: Agg) => void) {
  if (!month) return;
  if (!map.has(month)) map.set(month, emptyAgg());
  apply(map.get(month)!);
}
function monthLabel(m: string) {
  const [y, mm] = m.split("-");
  const names = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[Number(mm)] || mm} ${y}`;
}

function FunnelTab() {
  const q = useQuery({
    queryKey: ["analytics", "funnel"],
    queryFn: () => getJson<{ rows: FunnelRow[] }>("/api/analytics/funnel"),
  });
  const rows = useMemo(() => q.data?.rows ?? [], [q.data]);
  const [source, setSource] = useState("All");
  const [basis, setBasis] = useState<Basis>("activity");

  const sources = useMemo(
    () => [...new Set(rows.map((r) => r.source).filter(Boolean))].sort(),
    [rows],
  );

  const { months, total } = useMemo(() => {
    const scoped = rows.filter((r) => source === "All" || r.source === source);
    const byMonth = new Map<string, Agg>();
    const total = emptyAgg();
    for (const r of scoped) {
      // In cohort mode every stage is credited to the lead's created month.
      const leadM = r.leadMonth;
      const apptM = basis === "cohort" ? leadM : r.apptMonth;
      const propM = basis === "cohort" ? leadM : r.proposalMonth;
      const wonM = basis === "cohort" ? leadM : r.wonMonth;

      bump(byMonth, leadM, (a) => a.leads++);
      if (r.appt) bump(byMonth, apptM, (a) => a.appts++);
      if (r.proposal) bump(byMonth, propM, (a) => a.proposals++);
      if (r.won) bump(byMonth, wonM, (a) => { a.sold++; a.revenue += r.revenue; });

      if (r.leadMonth) total.leads++;
      if (r.appt) total.appts++;
      if (r.proposal) total.proposals++;
      if (r.won) { total.sold++; total.revenue += r.revenue; }
    }
    const months = [...byMonth.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, a]) => ({ month, ...a }));
    return { months, total };
  }, [rows, source, basis]);

  if (q.isLoading) return <p className="p-4 text-sm text-muted-foreground sm:p-6">Loading funnel…</p>;
  if (q.error) return <div className="p-4 sm:p-6"><ErrorBox error={q.error} /></div>;

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-semibold">Lead source</span>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          >
            <option value="All">All sources</option>
            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>

        <div className="inline-flex overflow-hidden rounded-md border border-input text-xs">
          <button
            type="button"
            onClick={() => setBasis("activity")}
            className={cn("px-3 py-1.5 font-medium", basis === "activity" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground")}
          >
            When it happened
          </button>
          <button
            type="button"
            onClick={() => setBasis("cohort")}
            className={cn("border-l border-input px-3 py-1.5 font-medium", basis === "cohort" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground")}
          >
            Lead cohort
          </button>
        </div>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2.5 font-semibold">Month</th>
              <Th>Leads</Th><Th>Appts</Th><Th>Proposals</Th><Th>Sold</Th><Th>Revenue</Th>
              <Th>Book %</Th><Th>Close %</Th><Th>$/Lead</Th>
            </tr>
          </thead>
          <tbody>
            <FunnelTr label="All time" a={total} bold />
            {months.map((m) => <FunnelTr key={m.month} label={monthLabel(m.month)} a={m} />)}
          </tbody>
        </table>
      </Card>
      <p className="max-w-[80ch] text-xs text-muted-foreground">
        {basis === "activity" ? (
          <>
            <strong>When it happened</strong> counts each stage in its own event
            month — a proposal in the month it was sent, a win in the month it
            closed — so a single lead can span several rows. Best for “how much did
            we send/close this month?”
          </>
        ) : (
          <>
            <strong>Lead cohort</strong> credits every stage back to the month the
            lead came in, so a row is the full lifetime of that month’s leads. Best
            for marketing ROI, but recent months look small because those leads
            haven’t converted yet.
          </>
        )}{" "}
        Stages nest: a sold job counts as a proposal and an appointment, so Leads ≥
        Appts ≥ Proposals ≥ Sold within a cohort. Book % = appts ÷ leads · Close % =
        sold ÷ proposals.
      </p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">{children}</th>;
}
function FunnelTd({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  return (
    <td className={cn("whitespace-nowrap px-3 py-2.5 text-right font-mono", bold ? "font-semibold text-foreground" : "text-muted-foreground")}>
      {children}
    </td>
  );
}
function FunnelTr({ label, a, bold }: { label: string; a: Agg; bold?: boolean }) {
  return (
    <tr className={cn("border-t", bold && "bg-muted/40")}>
      <td className={cn("whitespace-nowrap px-4 py-2.5", bold ? "font-bold" : "font-medium text-muted-foreground")}>{label}</td>
      <FunnelTd bold={bold}>{a.leads}</FunnelTd>
      <FunnelTd bold={bold}>{a.appts}</FunnelTd>
      <FunnelTd bold={bold}>{a.proposals}</FunnelTd>
      <FunnelTd bold={bold}>{a.sold}</FunnelTd>
      <FunnelTd bold={bold}>{money(a.revenue)}</FunnelTd>
      <FunnelTd bold={bold}>{pct(a.appts, a.leads)}</FunnelTd>
      <FunnelTd bold={bold}>{pct(a.sold, a.proposals)}</FunnelTd>
      <FunnelTd bold={bold}>{a.leads ? money(a.revenue / a.leads) : "—"}</FunnelTd>
    </tr>
  );
}

function ErrorBox({ error }: { error: unknown }) {
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      {error instanceof Error ? error.message : "Something went wrong."}
    </div>
  );
}
