// Server-only LeadConnector (GoHighLevel) v2 API client. The token never reaches
// the browser. Used by the missed-leads reconciliation sweep.
import "server-only";

const BASE = "https://services.leadconnectorhq.com";
// Accept either the mixed-case names or all-caps, so a re-typed host var
// (GHL_API_TOKEN / GHL_LOCATION_ID) still works.
const TOKEN = process.env.GHL_API_Token || process.env.GHL_API_TOKEN || "";
const LOCATION = process.env.GHL_Location_ID || process.env.GHL_LOCATION_ID || "";
const VERSION = "2021-07-28";
// The HighLevel web app host. Override only for white-label agency domains.
const APP_DOMAIN =
  process.env.GHL_App_Domain || process.env.GHL_APP_DOMAIN || "app.gohighlevel.com";

/** Whether GHL credentials are configured. */
export function hasGhlConfig(): boolean {
  return Boolean(TOKEN && LOCATION);
}

/**
 * Deep link to a contact in the GoHighLevel web app, or undefined when we can't
 * build one (no contact id, or the location isn't configured — e.g. the dev
 * sandbox has no GHL secrets). Location-scoped v2 URL so it resolves straight to
 * the contact detail regardless of which sub-account the user last opened.
 */
export function ghlContactUrl(contactId?: string): string | undefined {
  if (!contactId || !LOCATION) return undefined;
  return `https://${APP_DOMAIN}/v2/location/${encodeURIComponent(
    LOCATION,
  )}/contacts/detail/${encodeURIComponent(contactId)}`;
}

export interface GhlOpportunity {
  id: string;
  name: string;
  status: string; // open | won | lost | abandoned
  source: string;
  monetaryValue: number;
  createdAt: string;
  updatedAt: string;
  contactId: string;
  email: string;
  phone: string;
  contactName: string;
}

function assertConfig() {
  if (!TOKEN || !LOCATION) {
    throw new Error(
      "GHL_API_Token and GHL_Location_ID must be set in the host env vars.",
    );
  }
}

async function ghlGet(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Version: VERSION,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`GHL ${res.status} on ${url}: ${await res.text()}`);
  }
  return res.json();
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function normalize(o: Record<string, unknown>): GhlOpportunity {
  const c = (o.contact as Record<string, unknown> | undefined) ?? {};
  return {
    id: str(o.id),
    name: str(o.name),
    status: str(o.status),
    source: str(o.source),
    monetaryValue: Number(o.monetaryValue) || 0,
    createdAt: str(o.createdAt),
    updatedAt: str(o.updatedAt),
    contactId: str(o.contactId) || str(c.id),
    email: str(c.email).trim(),
    phone: str(c.phone).trim(),
    contactName: str(c.name) || str(o.name),
  };
}

/**
 * All GHL opportunities created on/after `sinceMs`, newest first. Walks the
 * cursor pages until it passes the window (results are createdAt-desc).
 * `hardCap` is a runaway guard.
 */
export async function opportunitiesSince(
  sinceMs: number,
  hardCap = 2000,
): Promise<GhlOpportunity[]> {
  assertConfig();
  const out: GhlOpportunity[] = [];
  let url =
    `${BASE}/opportunities/search` +
    `?location_id=${encodeURIComponent(LOCATION)}&limit=100`;

  while (url && out.length < hardCap) {
    const data = await ghlGet(url);
    const page = (data.opportunities as Record<string, unknown>[]) || [];
    if (!page.length) break;

    page.forEach((o) => out.push(normalize(o)));

    // Stop once the oldest row on this page predates the window.
    const oldest = page[page.length - 1];
    const oldestMs = Date.parse(str(oldest.createdAt) || str(oldest.updatedAt));
    if (oldestMs && oldestMs < sinceMs) break;

    const meta = data.meta as { nextPageUrl?: string } | undefined;
    url = meta?.nextPageUrl || "";
  }

  return out.filter((o) => {
    const ms = Date.parse(o.createdAt);
    return !Number.isNaN(ms) && ms >= sinceMs;
  });
}
