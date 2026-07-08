import "server-only";

import { airtable, type AirtableRecord } from "./client";
import { opportunityContactFields, opportunityFields, tables } from "./mapping";
import type { Opportunity } from "./types";

type OppAirtableFields = Record<string, unknown>;

function optString(v: unknown): string | undefined {
  if (Array.isArray(v)) {
    const first = v[0];
    return first === undefined || first === null ? undefined : String(first);
  }
  if (v === undefined || v === null || v === "") return undefined;
  // Airtable single-selects come back as a plain string; be defensive about the
  // `{ name }` object shape too.
  if (typeof v === "object" && v !== null && "name" in v) {
    return String((v as { name: unknown }).name);
  }
  return String(v);
}

function optNumber(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function firstLinkId(v: unknown): string | undefined {
  if (!Array.isArray(v) || v.length === 0) return undefined;
  const first = v[0];
  return typeof first === "string" ? first : (first?.id as string | undefined);
}

const f = opportunityFields;

function fromRecord(rec: AirtableRecord<OppAirtableFields>): Opportunity {
  const r = rec.fields;
  return {
    id: rec.id,
    name: String(r[f.name] ?? "") || "(unnamed)",
    contactId: firstLinkId(r[f.contact]),
    emailFromContact: optString(r[f.emailFromContact]),
    phone: optString(r[f.phoneFromContact]),
    source: optString(r[f.source]),
    rawSource: optString(r[f.rawSource]),
    captureMethod: optString(r[f.captureMethod]),
    jobType: optString(r[f.jobType]),
    leadType: optString(r[f.leadType]),
    setterStatus: optString(r[f.setterStatus]),
    disqualifyReason: optString(r[f.disqualifyReason]),
    appointmentStatus: optString(r[f.appointmentStatus]),
    leadCreatedAt: optString(r[f.leadCreatedAt]),
    firstContactedAt: optString(r[f.firstContactedAt]),
    lastContactedAt: optString(r[f.lastContactedAt]),
    bookedAt: optString(r[f.bookedAt]),
    disqualifiedAt: optString(r[f.disqualifiedAt]),
    abandonedAt: optString(r[f.abandonedAt]),
    appointmentAt: optString(r[f.appointmentAt]),
    nextFollowUpDate: optString(r[f.nextFollowUpDate]),
    contactAttempts: optNumber(r[f.contactAttempts]),
    proposalSent: r[f.proposalSent] === undefined ? undefined : Boolean(r[f.proposalSent]),
    proposalSentDate: optString(r[f.proposalSentDate]),
    proposalAmount: optNumber(r[f.proposalAmount]),
    wonAmount: optNumber(r[f.wonAmount]),
    saleOutcome: optString(r[f.saleOutcome]),
    reasonLost: optString(r[f.reasonLost]),
    dateOfSale: optString(r[f.dateOfSale]),
    estimator: optString(r[f.estimator]),
    matchEmail: optString(r[f.matchEmail]),
    ghlContactId: optString(r[f.ghlContactId]),
    ghlOpportunityId: optString(r[f.ghlOpportunityId]),
    paintScoutQuoteId: optString(r[f.paintScoutQuoteId]),
    notes: optString(r[f.notes]),
    createdTime: rec.createdTime,
  };
}

export const OpportunitiesRepo = {
  /**
   * Every opportunity, flattened. Analytics (sales rows, scorecard, funnel) all
   * compute in-process from this list — the win-rate / accounting math lives in
   * `lib/analytics/*`, not here, and not in components.
   */
  async list(): Promise<Opportunity[]> {
    const records = await airtable.listAll<OppAirtableFields>(tables.opportunities);
    return records.map(fromRecord);
  },

  async get(id: string): Promise<Opportunity> {
    const rec = await airtable.get<OppAirtableFields>(tables.opportunities, id);
    return fromRecord(rec);
  },

  /**
   * Batch-fetch the City for a set of NEW - Contacts record IDs. Used to slice
   * sales win-rate by city (the city lives on the contact, not the opportunity).
   * Chunked so the filterByFormula stays within Airtable's URL limits.
   */
  async citiesByContactIds(ids: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const uniq = [...new Set(ids)].filter(Boolean);
    for (let i = 0; i < uniq.length; i += 50) {
      const chunk = uniq.slice(i, i + 50);
      const formula = `OR(${chunk.map((id) => `RECORD_ID()='${id}'`).join(",")})`;
      const recs = await airtable.listAll<OppAirtableFields>(
        tables.opportunityContacts,
        {
          filterByFormula: formula,
          fields: [opportunityContactFields.city],
          pageSize: chunk.length,
        },
      );
      recs.forEach((rec) =>
        map.set(rec.id, optString(rec.fields[opportunityContactFields.city]) ?? ""),
      );
    }
    return map;
  },
};
