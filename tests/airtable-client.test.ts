import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Retry/backoff behavior of the Airtable client's request layer, exercised
 * through listAll with a mocked global fetch. The client module is imported
 * dynamically AFTER env vars are set because lib/env.ts snapshots process.env
 * at import time.
 */

function jsonResponse(status: number, body: unknown, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

async function loadClient() {
  vi.resetModules();
  process.env.AIRTABLE_PAT = "pat_test";
  process.env.AIRTABLE_BASE_ID = "appTEST";
  return await import("@/lib/airtable/client");
}

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("airtable client retry", () => {
  it("retries a 429 (honoring Retry-After) and succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(429, { error: { type: "RATE_LIMIT" } }, { "Retry-After": "0" }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { records: [{ id: "rec1", createdTime: "", fields: {} }] }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { airtable } = await loadClient();
    const records = await airtable.listAll("Projects");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(records).toHaveLength(1);
  });

  it("retries transient 5xx and surfaces the final error after max attempts", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(502, { error: { type: "BAD_GATEWAY", message: "upstream" } }, {
          "Retry-After": "0",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { airtable, AirtableError } = await loadClient();
    await expect(airtable.listAll("Projects")).rejects.toBeInstanceOf(AirtableError);
    expect(fetchMock).toHaveBeenCalledTimes(4); // MAX_ATTEMPTS
  });

  it("does NOT retry non-transient errors (422 invalid formula)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(422, {
        error: { type: "INVALID_FILTER_BY_FORMULA", message: "bad formula" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { airtable } = await loadClient();
    await expect(airtable.listAll("Projects")).rejects.toMatchObject({
      status: 422,
      type: "INVALID_FILTER_BY_FORMULA",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("updateMany chunks into batches of 10", async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { records: unknown[] };
      return jsonResponse(200, { records: body.records });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { airtable } = await loadClient();
    const records = Array.from({ length: 23 }, (_, i) => ({
      id: `rec${i}`,
      fields: { Source: "Google LSA" },
    }));
    const out = await airtable.updateMany("Opportunities", records);

    expect(fetchMock).toHaveBeenCalledTimes(3); // 10 + 10 + 3
    expect(out).toHaveLength(23);
  });
});
