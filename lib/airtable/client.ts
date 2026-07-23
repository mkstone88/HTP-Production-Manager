import "server-only";

import { requireAirtableEnv } from "@/lib/env";

const API_BASE = "https://api.airtable.com/v0";

type AirtableRecord<T = Record<string, unknown>> = {
  id: string;
  createdTime: string;
  fields: T;
};

type ListResponse<T> = {
  records: AirtableRecord<T>[];
  offset?: string;
};

type RequestOpts = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  // Tags/revalidation for Next.js fetch cache.
  next?: { revalidate?: number; tags?: string[] };
  cache?: RequestCache;
};

class AirtableError extends Error {
  status: number;
  type?: string;
  constructor(message: string, status: number, type?: string) {
    super(message);
    this.name = "AirtableError";
    this.status = status;
    this.type = type;
  }
}

// ---- Rate limiting + retry --------------------------------------------------
// Airtable allows 5 requests/second per base. Sequential write loops (sibling
// source updates, reconcile sweeps, backfill) can trip that; a 429 puts the
// base in a penalty box for ~30s. Two lines of defense:
//  1. A minimum-spacing throttle keeps this process at 4 req/s.
//  2. 429 and transient 5xx responses retry with backoff, honoring Retry-After.

const MIN_REQUEST_SPACING_MS = 250; // 4 req/s, margin under Airtable's 5
const MAX_ATTEMPTS = 4;
const MAX_RETRY_DELAY_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

let nextSlot = 0;
/** Wait for the next request slot (min spacing between request starts). */
async function throttle(): Promise<void> {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  nextSlot = slot + MIN_REQUEST_SPACING_MS;
  if (slot > now) await sleep(slot - now);
}

function retryDelayMs(res: Response, attempt: number): number {
  const retryAfter = Number(res.headers.get("Retry-After"));
  const ms =
    Number.isFinite(retryAfter) && retryAfter >= 0
      ? retryAfter * 1000
      : 500 * 2 ** (attempt - 1);
  return Math.min(ms, MAX_RETRY_DELAY_MS);
}

async function request<T = unknown>(
  path: string,
  opts: RequestOpts = {},
): Promise<T> {
  const { pat } = requireAirtableEnv();
  const url = new URL(`${API_BASE}${path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  for (let attempt = 1; ; attempt++) {
    await throttle();
    const res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: {
        Authorization: `Bearer ${pat}`,
        "Content-Type": "application/json",
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      next: opts.next,
      cache: opts.cache,
    });

    if (res.ok) return (await res.json()) as T;

    if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
      await sleep(retryDelayMs(res, attempt));
      continue;
    }

    let type: string | undefined;
    let message = `Airtable ${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { error?: { type?: string; message?: string } };
      type = body.error?.type;
      if (body.error?.message) message = body.error.message;
    } catch {
      // ignore
    }
    throw new AirtableError(message, res.status, type);
  }
}

export const airtable = {
  /**
   * List all records in a table, paginating until exhausted.
   */
  async listAll<T = Record<string, unknown>>(
    tableIdOrName: string,
    params: {
      view?: string;
      filterByFormula?: string;
      sort?: { field: string; direction?: "asc" | "desc" }[];
      pageSize?: number;
      maxRecords?: number;
      fields?: string[];
    } = {},
  ): Promise<AirtableRecord<T>[]> {
    const { baseId } = requireAirtableEnv();
    const records: AirtableRecord<T>[] = [];
    let offset: string | undefined;
    do {
      const query: Record<string, string | number | undefined> = {
        view: params.view,
        filterByFormula: params.filterByFormula,
        pageSize: params.pageSize ?? 100,
        maxRecords: params.maxRecords,
        offset,
      };
      // Airtable expects sort and fields as repeated params; encode manually.
      const search = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) search.set(k, String(v));
      }
      params.sort?.forEach((s, i) => {
        search.set(`sort[${i}][field]`, s.field);
        if (s.direction) search.set(`sort[${i}][direction]`, s.direction);
      });
      params.fields?.forEach((f) => search.append("fields[]", f));

      const url = `/${baseId}/${encodeURIComponent(tableIdOrName)}?${search.toString()}`;
      const page = await request<ListResponse<T>>(url);
      records.push(...page.records);
      offset = page.offset;
    } while (offset);
    return records;
  },

  async get<T = Record<string, unknown>>(
    tableIdOrName: string,
    recordId: string,
  ): Promise<AirtableRecord<T>> {
    const { baseId } = requireAirtableEnv();
    return request<AirtableRecord<T>>(
      `/${baseId}/${encodeURIComponent(tableIdOrName)}/${recordId}`,
    );
  },

  async create<T = Record<string, unknown>>(
    tableIdOrName: string,
    fields: Partial<T>,
  ): Promise<AirtableRecord<T>> {
    const { baseId } = requireAirtableEnv();
    return request<AirtableRecord<T>>(
      `/${baseId}/${encodeURIComponent(tableIdOrName)}`,
      { method: "POST", body: { fields } },
    );
  },

  async update<T = Record<string, unknown>>(
    tableIdOrName: string,
    recordId: string,
    fields: Partial<T>,
  ): Promise<AirtableRecord<T>> {
    const { baseId } = requireAirtableEnv();
    return request<AirtableRecord<T>>(
      `/${baseId}/${encodeURIComponent(tableIdOrName)}/${recordId}`,
      { method: "PATCH", body: { fields } },
    );
  },

  /**
   * Update many records with Airtable's batch endpoint (10 records per
   * request) instead of one PATCH per record — an order of magnitude fewer
   * requests for loops like "apply this source to every sibling lead".
   */
  async updateMany<T = Record<string, unknown>>(
    tableIdOrName: string,
    records: Array<{ id: string; fields: Partial<T> }>,
  ): Promise<AirtableRecord<T>[]> {
    const { baseId } = requireAirtableEnv();
    const out: AirtableRecord<T>[] = [];
    for (let i = 0; i < records.length; i += 10) {
      const page = await request<{ records: AirtableRecord<T>[] }>(
        `/${baseId}/${encodeURIComponent(tableIdOrName)}`,
        { method: "PATCH", body: { records: records.slice(i, i + 10) } },
      );
      out.push(...page.records);
    }
    return out;
  },

  async delete(tableIdOrName: string, recordId: string): Promise<void> {
    const { baseId } = requireAirtableEnv();
    await request(
      `/${baseId}/${encodeURIComponent(tableIdOrName)}/${recordId}`,
      { method: "DELETE" },
    );
  },

  /**
   * Inspect the schema of every table in the configured base.
   * Requires `schema.bases:read` scope on the PAT.
   */
  async listTables(): Promise<{
    tables: Array<{
      id: string;
      name: string;
      primaryFieldId: string;
      fields: Array<{
        id: string;
        name: string;
        type: string;
        description?: string;
        options?: Record<string, unknown>;
      }>;
      views: Array<{ id: string; name: string; type: string }>;
    }>;
  }> {
    const { baseId } = requireAirtableEnv();
    return request(`/meta/bases/${baseId}/tables`);
  },
};

export type { AirtableRecord };
export { AirtableError };
