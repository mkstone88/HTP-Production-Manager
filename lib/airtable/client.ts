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

// Airtable allows 5 requests/sec per base; on 429 it asks clients to back off.
const MAX_429_RETRIES = 2;

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
  const body = opts.body ? JSON.stringify(opts.body) : undefined;

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: {
        Authorization: `Bearer ${pat}`,
        "Content-Type": "application/json",
      },
      body,
      next: opts.next,
      cache: opts.cache,
    });

    if (res.status === 429 && attempt < MAX_429_RETRIES) {
      const retryAfter = Number(res.headers.get("Retry-After"));
      const waitMs =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 1000 * (attempt + 1);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    if (!res.ok) {
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

    return (await res.json()) as T;
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
      `/${baseId}/${encodeURIComponent(tableIdOrName)}/${encodeURIComponent(recordId)}`,
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
      `/${baseId}/${encodeURIComponent(tableIdOrName)}/${encodeURIComponent(recordId)}`,
      { method: "PATCH", body: { fields } },
    );
  },

  async delete(tableIdOrName: string, recordId: string): Promise<void> {
    const { baseId } = requireAirtableEnv();
    await request(
      `/${baseId}/${encodeURIComponent(tableIdOrName)}/${encodeURIComponent(recordId)}`,
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
