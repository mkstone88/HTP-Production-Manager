"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  DollarSign,
  Megaphone,
  Target,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import {
  LeadSource,
  type MarketingReport,
  type MarketingSourceTotal,
  type MarketingSpendRow,
  type SourceSignal,
} from "@/lib/airtable/types";
import { cn } from "@/lib/utils";

const money = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : `$${Math.round(n).toLocaleString()}`;
const money2 = (n: number) => `$${n.toFixed(0)}`;

function monthStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function shiftMonth(base: Date, delta: number): Date {
  return new Date(base.getFullYear(), base.getMonth() + delta, 1);
}
function fmtMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  if (!y || !mo) return m;
  return new Date(y, mo - 1, 1).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

/** Month-granularity quick ranges (from/to inclusive, "" = unbounded). */
function presetRange(kind: string): { from: string; to: string } {
  const now = new Date();
  const thisMonth = monthStr(now);
  if (kind === "thisMonth") return { from: thisMonth, to: thisMonth };
  if (kind === "lastMonth") {
    const m = monthStr(shiftMonth(now, -1));
    return { from: m, to: m };
  }
  if (kind === "last3") return { from: monthStr(shiftMonth(now, -2)), to: thisMonth };
  if (kind === "last6") return { from: monthStr(shiftMonth(now, -5)), to: thisMonth };
  if (kind === "thisYear") return { from: `${now.getFullYear()}-01`, to: thisMonth };
  return { from: "", to: "" }; // all time
}

const PRESETS: [string, string][] = [
  ["thisMonth", "This month"],
  ["lastMonth", "Last month"],
  ["last3", "Last 3 months"],
  ["last6", "Last 6 months"],
  ["thisYear", "This year"],
  ["all", "All time"],
];

const SIGNAL_META: Record<
  SourceSignal,
  { label: string; className: string }
> = {
  profitable: {
    label: "Keep spending",
    className: "border-success/40 bg-success/10 text-success",
  },
  marginal: {
    label: "Watch",
    className: "border-warning/40 bg-warning/10 text-warning",
  },
  unprofitable: {
    label: "Review",
    className: "border-destructive/40 bg-destructive/10 text-destructive",
  },
  "no-spend": {
    label: "Free",
    className: "border-border bg-muted text-muted-foreground",
  },
};

async function fetchReport(from: string, to: string): Promise<MarketingReport> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  const res = await fetch(`/api/marketing/roi${qs ? `?${qs}` : ""}`, {
    cache: "no-store",
  });
  const data = (await res.json()) as MarketingReport & { error?: string };
  if (!res.ok) throw new Error(data.error || "Failed to load marketing data");
  return data;
}

async function fetchSpend(): Promise<MarketingSpendRow[]> {
  const res = await fetch("/api/marketing/spend", { cache: "no-store" });
  const data = (await res.json()) as { rows?: MarketingSpendRow[]; error?: string };
  if (!res.ok || !data.rows) throw new Error(data.error || "Failed to load spend");
  return data.rows;
}

export function MarketingPanel() {
  const [range, setRange] = useState(() => presetRange("last6"));

  const report = useQuery({
    queryKey: ["marketing", "roi", range.from, range.to],
    queryFn: () => fetchReport(range.from, range.to),
  });

  if (report.isLoading) {
    return <p className="p-4 text-sm text-muted-foreground">Loading marketing data…</p>;
  }
  if (report.error || !report.data) {
    return (
      <div className="m-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        {report.error instanceof Error
          ? report.error.message
          : "Failed to load marketing data."}
      </div>
    );
  }
  const r = report.data;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Marketing ROI</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Spend vs what each source&apos;s leads turned into. Cohort view: a
          month&apos;s revenue is credited to the month the lead came in, so spend
          and results line up.
        </p>
      </div>

      {/* quick ranges + custom month bounds */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">Cohorts</span>
        {PRESETS.map(([kind, label]) => (
          <button
            key={kind}
            type="button"
            onClick={() => setRange(presetRange(kind))}
            className="rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            {label}
          </button>
        ))}
        <label className="ml-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-semibold">From</span>
          <input
            type="month"
            value={range.from}
            onChange={(e) => setRange((r0) => ({ ...r0, from: e.target.value }))}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
          />
        </label>
        <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-semibold">To</span>
          <input
            type="month"
            value={range.to}
            onChange={(e) => setRange((r0) => ({ ...r0, to: e.target.value }))}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
          />
        </label>
      </div>

      {/* paid-source tiles */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <Stat label="Ad spend" value={money(r.paid.spend)} icon={Megaphone} />
        <Stat label="Revenue from paid leads" value={money(r.paid.revenue)} icon={DollarSign} />
        <Stat
          label="Return per $1 spent"
          value={r.paid.roas === null ? "—" : `$${r.paid.roas.toFixed(2)}`}
          icon={TrendingUp}
          accent
        />
        <Stat
          label="Cost per lead"
          value={r.paid.costPerLead === null ? "—" : money2(r.paid.costPerLead)}
          icon={Target}
        />
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">
        Tiles cover paid sources only (spend logged in the range). At ~40% gross
        margin, break-even is $2.50 back per $1 spent — &ldquo;Keep spending&rdquo;
        means $5+, &ldquo;Watch&rdquo; means above break-even but thin.
      </p>

      <SourcesTable sources={r.sources} months={r.months} />

      <SpendEditor />
    </div>
  );
}

/* ---------------------------- per-source table ---------------------------- */

function SourcesTable({
  sources,
  months,
}: {
  sources: MarketingSourceTotal[];
  months: MarketingReport["months"];
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (source: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });

  if (sources.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        No leads or spend in this range.
      </Card>
    );
  }

  const pendingTotal = sources.reduce((s, x) => s + x.pending, 0);

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-semibold">Source</th>
              <th className="px-3 py-2 text-right font-semibold">Spend</th>
              <th className="px-3 py-2 text-right font-semibold">Leads</th>
              <th className="px-3 py-2 text-right font-semibold">Cost/lead</th>
              <th className="px-3 py-2 text-right font-semibold">Wins</th>
              <th className="px-3 py-2 text-right font-semibold">Close %</th>
              <th className="px-3 py-2 text-right font-semibold">Pending</th>
              <th className="px-3 py-2 text-right font-semibold">Revenue</th>
              <th className="px-3 py-2 text-right font-semibold">Per $1</th>
              <th className="px-3 py-2 text-right font-semibold">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => {
              const meta = SIGNAL_META[s.signal];
              const expanded = open.has(s.source);
              const monthRows = months.filter((m) => m.source === s.source);
              return (
                <SourceRows
                  key={s.source}
                  s={s}
                  meta={meta}
                  expanded={expanded}
                  monthRows={monthRows}
                  onToggle={() => toggle(s.source)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t px-3 py-2 text-xs text-muted-foreground">
        Revenue counts won jobs only, credited to the lead&apos;s month.
        {pendingTotal > 0 && (
          <>
            {" "}
            {pendingTotal} proposal{pendingTotal === 1 ? "" : "s"} in this range
            {pendingTotal === 1 ? " is" : " are"} still undecided — recent months
            improve as they close.
          </>
        )}{" "}
        Click a source for its month-by-month breakdown.
      </p>
    </Card>
  );
}

function SourceRows({
  s,
  meta,
  expanded,
  monthRows,
  onToggle,
}: {
  s: MarketingSourceTotal;
  meta: { label: string; className: string };
  expanded: boolean;
  monthRows: MarketingReport["months"];
  onToggle: () => void;
}) {
  const Chevron = expanded ? ChevronDown : ChevronRight;
  return (
    <>
      <tr
        className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/40"
        onClick={onToggle}
      >
        <td className="px-3 py-2.5 font-medium">
          <span className="inline-flex items-center gap-1">
            <Chevron className="size-3.5 shrink-0 text-muted-foreground" />
            {s.source}
          </span>
        </td>
        <td className="px-3 py-2.5 text-right font-mono">
          {s.spend > 0 ? money(s.spend) : "—"}
        </td>
        <td className="px-3 py-2.5 text-right font-mono">{s.leads}</td>
        <td className="px-3 py-2.5 text-right font-mono">
          {s.costPerLead === null ? "—" : money2(s.costPerLead)}
        </td>
        <td className="px-3 py-2.5 text-right font-mono">{s.wins}</td>
        <td className="px-3 py-2.5 text-right font-mono">{s.closeRate}%</td>
        <td className="px-3 py-2.5 text-right font-mono">
          {s.pending > 0 ? s.pending : "—"}
        </td>
        <td className="px-3 py-2.5 text-right font-mono">{money(s.revenue)}</td>
        <td className="px-3 py-2.5 text-right font-mono">
          {s.roas === null ? "—" : `$${s.roas.toFixed(2)}`}
        </td>
        <td className="px-3 py-2.5 text-right">
          <span
            className={cn(
              "inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold",
              meta.className,
            )}
          >
            {meta.label}
          </span>
        </td>
      </tr>
      {expanded &&
        monthRows.map((m) => (
          <tr key={m.month} className="border-b bg-muted/20 text-xs last:border-0">
            <td className="py-1.5 pl-9 pr-3 text-muted-foreground">{fmtMonth(m.month)}</td>
            <td className="px-3 py-1.5 text-right font-mono">
              {m.spend > 0 ? money(m.spend) : "—"}
            </td>
            <td className="px-3 py-1.5 text-right font-mono">{m.leads}</td>
            <td className="px-3 py-1.5 text-right font-mono">
              {m.spend > 0 && m.leads > 0 ? money2(m.spend / m.leads) : "—"}
            </td>
            <td className="px-3 py-1.5 text-right font-mono">{m.wins}</td>
            <td className="px-3 py-1.5 text-right font-mono">
              {m.leads > 0 ? `${Math.round((m.wins / m.leads) * 100)}%` : "—"}
            </td>
            <td className="px-3 py-1.5 text-right font-mono">
              {m.pending > 0 ? m.pending : "—"}
            </td>
            <td className="px-3 py-1.5 text-right font-mono">{money(m.revenue)}</td>
            <td className="px-3 py-1.5 text-right font-mono">
              {m.spend > 0 ? `$${(m.revenue / m.spend).toFixed(2)}` : "—"}
            </td>
            <td />
          </tr>
        ))}
    </>
  );
}

/* ------------------------------ spend editor ------------------------------ */

function SpendEditor() {
  const queryClient = useQueryClient();
  const spend = useQuery({ queryKey: ["marketing", "spend"], queryFn: fetchSpend });

  const [month, setMonth] = useState(() => monthStr(shiftMonth(new Date(), -1)));
  const [source, setSource] = useState<string>("Google LSA");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  // Editing an already-logged cell? Prefill so saving corrects, not surprises.
  // Derived-state-during-render (not an effect) so typing is never clobbered:
  // the prefill applies once per (month, source) selection.
  const existing = useMemo(
    () => spend.data?.find((r) => r.month === month && r.source === source),
    [spend.data, month, source],
  );
  const cellKey = spend.data ? `${month}|${source}` : null;
  const [prefilledKey, setPrefilledKey] = useState<string | null>(null);
  if (cellKey !== null && prefilledKey !== cellKey) {
    setPrefilledKey(cellKey);
    setAmount(existing ? String(existing.amount) : "");
    setNotes(existing?.notes ?? "");
  }

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/marketing/spend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          source,
          amount: Number(amount),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to save spend");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing"] });
    },
  });

  const amountValid = amount !== "" && Number.isFinite(Number(amount)) && Number(amount) >= 0;
  const recent = useMemo(
    () =>
      [...(spend.data ?? [])].sort(
        (a, b) => b.month.localeCompare(a.month) || a.source.localeCompare(b.source),
      ),
    [spend.data],
  );

  return (
    <Card className="p-5">
      <h3 className="text-base font-semibold">Log ad spend</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        One number per source per month. Logging a month that&apos;s already
        recorded updates it.
      </p>

      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (amountValid) save.mutate();
        }}
      >
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          Month
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            required
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm font-normal text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          Source
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm font-normal text-foreground"
          >
            {LeadSource.options.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          Amount ($)
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="w-28 rounded-md border border-input bg-background px-2 py-1.5 text-sm font-normal text-foreground"
          />
        </label>
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs font-semibold text-muted-foreground">
          Notes (optional)
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm font-normal text-foreground"
          />
        </label>
        <button
          type="submit"
          disabled={!amountValid || save.isPending}
          className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : existing ? "Update" : "Save"}
        </button>
      </form>
      {save.error && (
        <p className="mt-2 text-sm text-destructive">
          {save.error instanceof Error ? save.error.message : "Failed to save spend."}
        </p>
      )}

      {recent.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-1.5 pr-3 font-semibold">Month</th>
                <th className="py-1.5 pr-3 font-semibold">Source</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Amount</th>
                <th className="py-1.5 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/40"
                  onClick={() => {
                    setMonth(row.month);
                    setSource(row.source);
                  }}
                  title="Click to edit"
                >
                  <td className="py-1.5 pr-3">{fmtMonth(row.month)}</td>
                  <td className="py-1.5 pr-3">{row.source}</td>
                  <td className="py-1.5 pr-3 text-right font-mono">
                    ${row.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="max-w-64 truncate py-1.5 text-xs text-muted-foreground">
                    {row.notes ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------ presentation ------------------------------ */

function Stat({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: typeof DollarSign;
  accent?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div
        className={cn(
          "text-2xl font-semibold leading-none md:text-[32px]",
          accent ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </div>
    </Card>
  );
}
