import "server-only";

import { airtable, type AirtableRecord } from "./client";
import { escapeFormulaValue } from "./formula";
import { opportunityFields, tables } from "./mapping";
import { OpportunityContactsRepo } from "./opportunity-contacts";
import { SourceMappingRepo } from "./source-mapping";
import type { SourceReviewRow } from "./types";

const f = opportunityFields;
type OppFields = Record<string, unknown>;

/** Where unresolved raw sources are parked. */
export const NEEDS_REVIEW = "Needs Review";

function opt(v: unknown): string | undefined {
  if (Array.isArray(v)) return v[0] == null ? undefined : String(v[0]);
  if (v === undefined || v === null || v === "") return undefined;
  return String(v);
}
function firstLinkId(v: unknown): string | undefined {
  return Array.isArray(v) && v.length > 0 ? String(v[0]) : undefined;
}

function toRow(rec: AirtableRecord<OppFields>, name?: string): SourceReviewRow {
  const r = rec.fields;
  return {
    id: rec.id,
    name: name || String(r[f.name] ?? "") || "(unnamed)",
    email: opt(r[f.matchEmail]) ?? opt(r[f.emailFromContact]),
    rawSource: opt(r[f.rawSource]),
    source: opt(r[f.source]),
    createdAt: opt(r[f.leadCreatedAt]) ?? rec.createdTime,
  };
}

async function enrich(recs: AirtableRecord<OppFields>[]): Promise<SourceReviewRow[]> {
  const ids = recs
    .map((r) => firstLinkId(r.fields[f.contact]))
    .filter((v): v is string => Boolean(v));
  const byId = ids.length ? await OpportunityContactsRepo.byIds(ids) : new Map();
  return recs.map((rec) => {
    const cid = firstLinkId(rec.fields[f.contact]);
    return toRow(rec, cid ? byId.get(cid)?.name : undefined);
  });
}

export const SourcesRepo = {
  /** Leads whose Source is blank or parked at "Needs Review". */
  async listReview(): Promise<SourceReviewRow[]> {
    const recs = await airtable.listAll<OppFields>(tables.opportunities, {
      filterByFormula: `OR({${f.source}}='${NEEDS_REVIEW}', {${f.source}}=BLANK())`,
      sort: [{ field: f.leadCreatedAt, direction: "desc" }],
    });
    return enrich(recs);
  },

  /** Find any lead by name or email to correct a wrongly-attributed source. */
  async search(query: string): Promise<SourceReviewRow[]> {
    const q = escapeFormulaValue(query.trim().toLowerCase());
    if (!q) return [];
    const recs = await airtable.listAll<OppFields>(tables.opportunities, {
      filterByFormula: `OR(SEARCH('${q}', LOWER({${f.name}})), SEARCH('${q}', LOWER({${f.matchEmail}})))`,
      sort: [{ field: f.leadCreatedAt, direction: "desc" }],
      pageSize: 25,
    });
    return enrich(recs.slice(0, 25));
  },

  /**
   * Set the canonical Source on one opportunity. When `remember` is true and the
   * lead has a Raw Source, also (1) save the alias to Source Mapping and (2) apply
   * the same Source to every other still-unresolved lead sharing that raw value —
   * so one decision clears the whole batch and future leads auto-normalize.
   * Returns how many sibling leads were updated alongside.
   */
  async setSource(
    id: string,
    source: string,
    remember: boolean,
    by: string,
  ): Promise<{ applied: number }> {
    const opp = await airtable.get<OppFields>(tables.opportunities, id);
    const rawSource = (opt(opp.fields[f.rawSource]) ?? "").trim();

    await airtable.update<OppFields>(tables.opportunities, id, {
      [f.source]: source,
      [f.lastAction]: "set-source",
      [f.lastActionBy]: by,
      [f.lastActionAt]: new Date().toISOString(),
    });

    if (!remember || !rawSource) return { applied: 0 };

    await SourceMappingRepo.upsert(rawSource, source);

    const siblings = await airtable.listAll<OppFields>(tables.opportunities, {
      filterByFormula: `AND(OR({${f.source}}='${NEEDS_REVIEW}', {${f.source}}=BLANK()), LOWER({${f.rawSource}})='${escapeFormulaValue(
        rawSource.toLowerCase(),
      )}')`,
      fields: [f.source],
    });
    const targets = siblings
      .filter((s) => s.id !== id)
      .map((s) => ({ id: s.id, fields: { [f.source]: source } }));
    await airtable.updateMany<OppFields>(tables.opportunities, targets);
    return { applied: targets.length };
  },
};
