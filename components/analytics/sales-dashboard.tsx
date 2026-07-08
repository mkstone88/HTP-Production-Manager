"use client";

import { useQuery } from "@tanstack/react-query";
import { DollarSign, Percent, RotateCcw, Trophy, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import type { SalesRow } from "@/lib/airtable/types";
import { cn } from "@/lib/utils";

const SIZE_BUCKETS: [number, number, string][] = [
  [0, 2500, "< $2.5k"],
  [2500, 5000, "$2.5–5k"],
  [5000, 10000, "$5–10k"],
  [10000, 20000, "$10–20k"],
  [20000, Infinity, "$20k+"],
];

function quarter(period: string): string {
  if (!period) return "";
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return "";
  return `${y} Q${Math.floor((m - 1) / 3) + 1}`;
}
const money = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : `$${Math.round(n).toLocaleString()}`;

function uniq(rows: SalesRow[], key: keyof SalesRow): string[] {
  return [...new Set(rows.map((r) => String(r[key])).filter(Boolean))].sort();
}

type Basis = "sent" | "accepted" | "lead";
const BASIS_LABEL: Record<Basis, string> = {
  sent: "proposal sent date",
  accepted: "proposal accepted date",
  lead: "lead created date",
};

function fmtLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

/** Local calendar range for a quick-select preset. */
function presetRange(kind: string): { from: string; to: string } {
  const now = new Date();
  const startOfWeek = (base: Date) => {
    const d = new Date(base);
    const dow = (d.getDay() + 6) % 7; // Monday = 0
    d.setDate(d.getDate() - dow);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  if (kind === "thisWeek") {
    const s = startOfWeek(now);
    const e = new Date(s);
    e.setDate(s.getDate() + 6);
    return { from: fmtLocal(s), to: fmtLocal(e) };
  }
  if (kind === "lastWeek") {
    const s = startOfWeek(now);
    s.setDate(s.getDate() - 7);
    const e = new Date(s);
    e.setDate(s.getDate() + 6);
    return { from: fmtLocal(s), to: fmtLocal(e) };
  }
  if (kind === "thisMonth") {
    return {
      from: fmtLocal(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: fmtLocal(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  }
  if (kind === "lastMonth") {
    return {
      from: fmtLocal(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: fmtLocal(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }
  if (kind === "thisYear") {
    return {
      from: fmtLocal(new Date(now.getFullYear(), 0, 1)),
      to: fmtLocal(new Date(now.getFullYear(), 11, 31)),
    };
  }
  return { from: "", to: "" }; // all time
}

const PRESETS: [string, string][] = [
  ["thisWeek", "This week"],
  ["lastWeek", "Last week"],
  ["thisMonth", "This month"],
  ["lastMonth", "Last month"],
  ["thisYear", "This year"],
  ["all", "All time"],
];

async function fetchSalesRows(): Promise<SalesRow[]> {
  const res = await fetch("/api/analytics/sales", { cache: "no-store" });
  const data = (await res.json()) as { rows?: SalesRow[]; error?: string };
  if (!res.ok || !data.rows) throw new Error(data.error || "Failed to load sales data");
  return data.rows;
}

export function SalesDashboard() {
  const query = useQuery({ queryKey: ["analytics", "sales"], queryFn: fetchSalesRows });
  const rows = useMemo(() => query.data ?? [], [query.data]);

  const [basis, setBasis] = useState<Basis>("sent");
  const [jobType, setJobType] = useState("All");
  const [source, setSource] = useState("All");
  const [city, setCity] = useState("All");
  const [year, setYear] = useState("All");
  const [from, setFrom] = useState(""); // YYYY-MM-DD
  const [to, setTo] = useState("");

  // The date a row is anchored on for filtering/bucketing, per the chosen basis.
  const activeDate = (r: SalesRow) =>
    basis === "sent" ? r.sentDate : basis === "accepted" ? r.acceptedDate : r.date;
  const activePeriod = (r: SalesRow) => activeDate(r).slice(0, 7);

  const years = useMemo(
    () => [...new Set(rows.map((r) => activeDate(r).slice(0, 4)).filter(Boolean))].sort(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, basis],
  );
  const jobTypes = useMemo(() => uniq(rows, "jobType"), [rows]);
  const sources = useMemo(() => uniq(rows, "source"), [rows]);
  const cities = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((r) => counts.set(r.city, (counts.get(r.city) || 0) + 1));
    return [...counts.entries()]
      .filter(([, n]) => n >= 8)
      .sort((a, b) => b[1] - a[1])
      .map(([c]) => c);
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const ad = activeDate(r);
        return (
          (jobType === "All" || r.jobType === jobType) &&
          (source === "All" || r.source === source) &&
          (city === "All" || r.city === city) &&
          (year === "All" || ad.startsWith(year)) &&
          (!from || (ad !== "" && ad >= from)) &&
          (!to || (ad !== "" && ad <= to))
        );
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, jobType, source, city, year, from, to, basis],
  );

  const wins = filtered.filter((r) => r.won);
  const winCount = wins.length;
  const pendingCount = filtered.filter((r) => r.pending).length;
  const lossCount = filtered.length - winCount - pendingCount;
  // Win rate = won ÷ ALL proposals sent. Pending counts against the rate until
  // it converts, so the rate creeps up as pending proposals become Won.
  const rate = filtered.length ? Math.round((winCount / filtered.length) * 100) : 0;
  const wonRev = wins.reduce((s, r) => s + r.amount, 0);
  const avgWon = winCount ? wonRev / winCount : 0;
  const pendingRev = filtered
    .filter((r) => r.pending)
    .reduce((s, r) => s + r.amount, 0);

  const hasFilters =
    jobType !== "All" ||
    source !== "All" ||
    city !== "All" ||
    year !== "All" ||
    Boolean(from) ||
    Boolean(to);

  if (query.isLoading) {
    return <p className="p-4 text-sm text-muted-foreground">Loading sales data…</p>;
  }
  if (query.error) {
    return (
      <div className="m-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        {query.error instanceof Error ? query.error.message : "Failed to load sales data."}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Sales performance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {rows.length.toLocaleString()} proposals sent · live from Airtable · filter
          to slice by type, source, city, and year.
        </p>
      </div>

      {/* date basis + quick ranges */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Dates by</span>
          <div className="inline-flex overflow-hidden rounded-md border">
            {(["sent", "accepted", "lead"] as const).map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setBasis(val)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium transition-colors",
                  basis === val
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                {val === "sent" ? "Proposal sent" : val === "accepted" ? "Proposal accepted" : "Lead created"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Quick range</span>
          {PRESETS.map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              onClick={() => {
                const r = presetRange(kind);
                setFrom(r.from);
                setTo(r.to);
                setYear("All");
              }}
              className="rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select label="Type" value={jobType} onChange={setJobType} options={jobTypes} />
        <Select label="Source" value={source} onChange={setSource} options={sources} />
        <Select label="City" value={city} onChange={setCity} options={cities} />
        <Select label="Year" value={year} onChange={setYear} options={years} />
        <DateFilter label="From" value={from} onChange={setFrom} />
        <DateFilter label="To" value={to} onChange={setTo} />
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setJobType("All");
              setSource("All");
              setCity("All");
              setYear("All");
              setFrom("");
              setTo("");
            }}
            className="ml-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <RotateCcw className="size-3.5" />
            Reset
          </button>
        )}
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <Stat label="Win rate" value={`${rate}%`} icon={Percent} accent />
        <Stat
          label="Won / lost / pending"
          value={`${winCount} / ${lossCount} / ${pendingCount}`}
          icon={TrendingUp}
        />
        <Stat label="Won revenue" value={money(wonRev)} icon={DollarSign} />
        <Stat label="Avg won job" value={money(avgWon)} icon={Trophy} />
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">
        Slicing by {BASIS_LABEL[basis]}. Win rate = won ÷ all proposals in view (
        {filtered.length.toLocaleString()}).
        {basis === "accepted" &&
          " Accepted-date view surfaces closed deals, so the win rate isn't meaningful in this mode — use it for revenue and counts."}
        {pendingCount > 0 && basis !== "accepted" && (
          <>
            {" "}
            The {pendingCount} pending proposal{pendingCount === 1 ? "" : "s"} (
            {money(pendingRev)}) count against the rate until they close — so it rises
            as they convert, and past months update themselves.
          </>
        )}
      </p>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No proposals match these filters.
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <BarCard title="Win rate by job type" groups={groupRate(filtered, (r) => r.jobType)} />
          <BarCard title="Win rate by lead source" groups={groupRate(filtered, (r) => r.source)} />
          <BarCard title="Win rate by job size" groups={sizeGroups(filtered)} ordered />
          <BarCard
            title="Win rate by quarter"
            groups={quarterGroups(filtered, activePeriod)}
            ordered
          />
          <div className="md:col-span-2">
            <BarCard
              title="Win rate by city"
              groups={groupRate(filtered, (r) => r.city, 8)}
              showAvg
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---- aggregation (math preserved verbatim from the appointment-setter app) ----
interface Grp {
  key: string;
  won: number;
  total: number;
  rate: number;
  avgWon: number;
}
function summarize(rows: SalesRow[]): Omit<Grp, "key"> {
  const won = rows.filter((r) => r.won);
  const total = rows.length;
  const avgWon = won.length ? won.reduce((s, r) => s + r.amount, 0) / won.length : 0;
  return {
    won: won.length,
    total,
    rate: total ? Math.round((won.length / total) * 100) : 0,
    avgWon,
  };
}
function groupRate(
  rows: SalesRow[],
  keyFn: (r: SalesRow) => string,
  minN = 1,
): Grp[] {
  const m = new Map<string, SalesRow[]>();
  rows.forEach((r) => {
    const k = keyFn(r) || "Unknown";
    (m.get(k) || m.set(k, []).get(k)!).push(r);
  });
  return [...m.entries()]
    .map(([key, rs]) => ({ key, ...summarize(rs) }))
    .filter((g) => g.total >= minN)
    .sort((a, b) => b.total - a.total);
}
function sizeGroups(rows: SalesRow[]): Grp[] {
  return SIZE_BUCKETS.map(([lo, hi, label]) => ({
    key: label,
    ...summarize(rows.filter((r) => r.amount >= lo && r.amount < hi)),
  })).filter((g) => g.total > 0);
}
function quarterGroups(rows: SalesRow[], periodOf: (r: SalesRow) => string): Grp[] {
  const m = new Map<string, SalesRow[]>();
  rows.forEach((r) => {
    const q = quarter(periodOf(r));
    if (!q) return;
    (m.get(q) || m.set(q, []).get(q)!).push(r);
  });
  return [...m.entries()]
    .map(([key, rs]) => ({ key, ...summarize(rs) }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

// ---- presentation ----
function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="font-semibold">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
      >
        <option value="All">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function DateFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="font-semibold">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
      />
    </label>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: typeof Percent;
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

function BarCard({
  title,
  groups,
  ordered,
  showAvg,
}: {
  title: string;
  groups: Grp[];
  ordered?: boolean;
  showAvg?: boolean;
}) {
  const rows = ordered ? groups : [...groups].sort((a, b) => b.rate - a.rate);
  return (
    <Card className="p-5">
      <h3 className="mb-4 text-base font-semibold">{title}</h3>
      <div className="flex flex-col gap-2.5">
        {rows.map((g) => {
          const color =
            g.rate >= 45
              ? "bg-success"
              : g.rate <= 28
                ? "bg-destructive"
                : "bg-primary";
          return (
            <div
              key={g.key}
              className="grid grid-cols-[110px_1fr_auto] items-center gap-2 text-sm"
            >
              <div className="truncate text-muted-foreground" title={g.key}>
                {g.key}
              </div>
              <div className="h-5 overflow-hidden rounded bg-muted">
                <div
                  className={cn("h-full rounded", color)}
                  style={{ width: `${Math.max(g.rate, 2)}%` }}
                />
              </div>
              <div className="w-24 text-right font-mono font-semibold text-foreground">
                {g.rate}%
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  {showAvg && g.avgWon ? money(g.avgWon) : `n=${g.total}`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
