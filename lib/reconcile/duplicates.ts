// Data-integrity check: find records that share a GHL id. Airtable enforces no
// uniqueness, so a Zapier race (or a path that failed to stamp/find the id) can
// create two rows with the same GHL Opportunity ID or GHL Contact ID. Read-only
// detection — resolving/merging is a human decision.
import "server-only";

import { OpportunitiesRepo } from "@/lib/airtable/opportunities";
import { OpportunityContactsRepo } from "@/lib/airtable/opportunity-contacts";
import type { DupGroup, DuplicateReport } from "@/lib/airtable/types";

function groupByGhlId<T>(
  rows: T[],
  getId: (r: T) => string | undefined,
  toRow: (r: T) => DupGroup["rows"][number],
): DupGroup[] {
  const map = new Map<string, DupGroup["rows"]>();
  for (const r of rows) {
    const gid = (getId(r) ?? "").trim();
    if (!gid) continue; // blanks are not collisions
    const list = map.get(gid) ?? [];
    list.push(toRow(r));
    map.set(gid, list);
  }
  return [...map.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([ghlId, list]) => ({ ghlId, rows: list }));
}

export async function findDuplicates(): Promise<DuplicateReport> {
  const [opps, contacts] = await Promise.all([
    OpportunitiesRepo.list(),
    OpportunityContactsRepo.list(),
  ]);

  return {
    ranAt: new Date().toISOString(),
    opportunities: groupByGhlId(
      opps,
      (o) => o.ghlOpportunityId,
      (o) => ({
        id: o.id,
        label: o.name || "(unnamed)",
        extra: [o.setterStatus || "", (o.leadCreatedAt || "").slice(0, 10)]
          .filter(Boolean)
          .join(" · "),
      }),
    ),
    contacts: groupByGhlId(
      contacts,
      (c) => c.ghlContactId,
      (c) => ({ id: c.id, label: c.name || "(no name)", extra: c.email || "" }),
    ),
  };
}
