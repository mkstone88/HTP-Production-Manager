// Server-only PaintScout v2 API client. Feeds the weekly scorecard's Invoiced /
// Collected columns and (later) the proposal reconciliation sweep. The key never
// reaches the browser.
import "server-only";

const BASE = "https://openapi.paintscout.com/v2";
// Accept the Vercel var name (PaintScout_API_Key) and the documented all-caps one.
const KEY = process.env.PaintScout_API_Key || process.env.PAINTSCOUT_API_TOKEN || "";

/** Whether a PaintScout key is configured. Callers can skip gracefully if not. */
export function hasPaintScoutKey(): boolean {
  return Boolean(KEY);
}

function assertKey() {
  if (!KEY) {
    throw new Error(
      "PaintScout_API_Key is not set. Add it to the host env vars to enable Invoiced/Collected.",
    );
  }
}

const ms2date = (ms: number | undefined | null) =>
  ms ? new Date(ms).toISOString().slice(0, 10) : null;

async function get(path: string): Promise<Record<string, unknown>> {
  assertKey();
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${KEY}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`PaintScout ${res.status} on ${path}: ${await res.text()}`);
  }
  return res.json();
}

export interface PsInvoice {
  id: string;
  number: number;
  status: string; // e.g. partial | paid | ...
  createdDate: string | null; // YYYY-MM-DD — when the invoice was issued
  total: number; // afterTax
  payments: { date: string; amount: number }[];
}

export interface PsQuote {
  id: string;
  number: number;
  status: string; // draft | sent | viewed | accepted | declined | onHold
  email: string;
  name: string;
  jobType: string;
  sentDate: string | null; // YYYY-MM-DD
  acceptedDate: string | null;
  total: number;
}

/** All quotes, paginated (API caps at 50/page). Used by the proposal sweep. */
export async function listAllQuotes(): Promise<PsQuote[]> {
  const out: PsQuote[] = [];
  let page = 1;
  let total = Infinity;
  while (out.length < total && page < 100) {
    const d = await get(`/quotes?perPage=50&page=${page}`);
    total = (d.totalRows as number) ?? 0;
    const rows = (d.rows as Record<string, unknown>[]) || [];
    if (!rows.length) break;
    for (const q of rows) {
      const c = (q.contact as Record<string, unknown>) || {};
      const dates = (q.dates as { sent?: number; quote?: number; accepted?: number }) || {};
      const totals = q.totals as { afterTax?: number } | undefined;
      const quoteType = q.quoteType as { label?: string } | undefined;
      out.push({
        id: String(q.id),
        number: Number(q.number),
        status: String(q.status || ""),
        email: String(c.email || "").trim().toLowerCase(),
        name: [c.firstName, c.lastName].filter(Boolean).join(" "),
        jobType: quoteType?.label || "",
        sentDate: ms2date(dates.sent || dates.quote),
        acceptedDate: ms2date(dates.accepted),
        total: totals?.afterTax || 0,
      });
    }
    page++;
  }
  return out;
}

/** All invoices, paginated. Used for weekly Revenue Invoiced / Collected. */
export async function listAllInvoices(): Promise<PsInvoice[]> {
  const out: PsInvoice[] = [];
  let page = 1;
  let total = Infinity;
  while (out.length < total && page < 100) {
    const d = await get(`/invoices?perPage=50&page=${page}`);
    total = (d.totalRows as number) ?? 0;
    const rows = (d.rows as Record<string, unknown>[]) || [];
    if (!rows.length) break;
    for (const inv of rows) {
      const timestamp = inv.timestamp as { created?: number } | undefined;
      const dates = inv.dates as { quote?: number } | undefined;
      const totals = inv.totals as { afterTax?: number } | undefined;
      const payments = (inv.payments as { date?: number; amount?: number }[]) || [];
      out.push({
        id: String(inv.id),
        number: Number(inv.number),
        status: String(inv.status || ""),
        createdDate: ms2date(timestamp?.created || dates?.quote),
        total: totals?.afterTax || 0,
        payments: payments
          .filter((p) => p?.date && p?.amount)
          .map((p) => ({ date: ms2date(p.date)!, amount: p.amount as number })),
      });
    }
    page++;
  }
  return out;
}
