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

      <MonthEndSpendForm />
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

/* --------------------------- month-end spend form -------------------------- */

/**
 * The month-end ritual: pick a month, see every source with what's already
 * logged prefilled, type the numbers, save once. Reopening a month edits it.
 */
function MonthEndSpendForm() {
  const queryClient = useQueryClient();
  const spend = useQuery({ queryKey: ["marketing", "spend"], queryFn: fetchSpend });

  const [month, setMonth] = useState(() => monthStr(shiftMonth(new Date(), -1)));
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savedMsg, setSavedMsg] = useState("");

  // What's already in Airtable for the chosen month, by source.
  const logged = useMemo(() => {
    const m = new Map<string, MarketingSpendRow>();
    (spend.data ?? []).forEach((r) => {
      if (r.month === month) m.set(r.source, r);
    });
    return m;
  }, [spend.data, month]);

  // Prefill the grid once per month selection (derived-state-during-render,
  // not an effect, so typing is never clobbered by a background refetch).
  const prefillKey = spend.data ? month : null;
  const [prefilledKey, setPrefilledKey] = useState<string | null>(null);
  if (prefillKey !== null && prefilledKey !== prefillKey) {
    setPrefilledKey(prefillKey);
    setDraft(
      Object.fromEntries(
        LeadSource.options.map((s) => {
          const row = logged.get(s);
          return [s, row ? String(row.amount) : ""];
        }),
      ),
    );
    setSavedMsg("");
  }

  // Only write sources that were filled in AND differ from what's logged —
  // blanks are left untouched, so a partial pass never zeroes the rest.
  const entries = useMemo(
    () =>
      LeadSource.options.flatMap((source) => {
        const raw = (draft[source] ?? "").trim();
        if (raw === "") return [];
        const amount = Number(raw);
        if (!Number.isFinite(amount) || amount < 0) return [];
        if (logged.get(source)?.amount === amount) return [];
        return [{ source, amount }];
      }),
    [draft, logged],
  );
  const invalid = LeadSource.options.some((s) => {
    const raw = (draft[s] ?? "").trim();
    return raw !== "" && (!Number.isFinite(Number(raw)) || Number(raw) < 0);
  });
  const monthTotal = LeadSource.options.reduce((sum, s) => {
    const raw = (draft[s] ?? "").trim();
    const n = Number(raw);
    return raw !== "" && Number.isFinite(n) ? sum + n : sum;
  }, 0);

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/marketing/spend/month", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, entries }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to save spend");
      return entries.length;
    },
    onSuccess: (count) => {
      setSavedMsg(
        `Saved ${count} source${count === 1 ? "" : "s"} for ${fmtMonth(month)}.`,
      );
      queryClient.invalidateQueries({ queryKey: ["marketing"] });
    },
  });

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Month-end spend</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter what each source cost this month and save once. Pull the month
            back up any time to correct it.
          </p>
        </div>
        <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          Month
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm font-normal text-foreground"
          />
        </label>
      </div>

      {spend.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading logged spend…</p>
      ) : (
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (entries.length > 0 && !invalid) save.mutate();
          }}
        >
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {LeadSource.options.map((source) => {
              const row = logged.get(source);
              return (
                <label
                  key={source}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate">{source}</span>
                    {row?.notes && (
                      <span
                        className="block max-w-44 truncate text-[11px] text-muted-foreground"
                        title={row.notes}
                      >
                        {row.notes}
                      </span>
                    )}
                  </span>
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    $
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="—"
                      value={draft[source] ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [source]: e.target.value }))
                      }
                      className="w-28 rounded-md border border-input bg-background px-2 py-1.5 text-right text-sm text-foreground"
                    />
                  </span>
                </label>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={entries.length === 0 || invalid || save.isPending}
              className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
            >
              {save.isPending
                ? "Saving…"
                : entries.length > 0
                  ? `Save ${entries.length} source${entries.length === 1 ? "" : "s"}`
                  : "Save"}
            </button>
            <span className="text-xs text-muted-foreground">
              {fmtMonth(month)} total: {money(monthTotal)}. Blank = leave as is;
              enter 0 for a paused source.
            </span>
          </div>
          {save.error && (
            <p className="mt-2 text-sm text-destructive">
              {save.error instanceof Error
                ? save.error.message
                : "Failed to save spend."}
            </p>
          )}
          {savedMsg && !save.isPending && !save.error && (
            <p className="mt-2 text-sm text-success">{savedMsg}</p>
          )}
        </form>
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
