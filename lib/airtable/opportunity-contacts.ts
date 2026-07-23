import "server-only";

import { airtable } from "./client";
import { escapeFormulaValue } from "./formula";
import { opportunityContactFields, tables } from "./mapping";

const cf = opportunityContactFields;

export type OpportunityContact = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  ghlContactId?: string;
};

function opt(v: unknown): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  return String(v);
}


export const OpportunityContactsRepo = {
  /** All NEW - Contacts, minimal shape. Used by the duplicate-detection sweep. */
  async list(): Promise<OpportunityContact[]> {
    const recs = await airtable.listAll<Record<string, unknown>>(
      tables.opportunityContacts,
      { fields: [cf.name, cf.email, cf.ghlContactId] },
    );
    return recs.map((r) => ({
      id: r.id,
      name: String(r.fields[cf.name] ?? ""),
      email: opt(r.fields[cf.email]),
      ghlContactId: opt(r.fields[cf.ghlContactId]),
    }));
  },

  /** Batch-fetch name/phone for a set of contact record IDs (queue enrichment). */
  async byIds(ids: string[]): Promise<Map<string, OpportunityContact>> {
    const map = new Map<string, OpportunityContact>();
    const uniq = [...new Set(ids)].filter(Boolean);
    for (let i = 0; i < uniq.length; i += 50) {
      const chunk = uniq.slice(i, i + 50);
      const formula = `OR(${chunk.map((id) => `RECORD_ID()='${id}'`).join(",")})`;
      const recs = await airtable.listAll<Record<string, unknown>>(
        tables.opportunityContacts,
        { filterByFormula: formula, fields: [cf.name, cf.phone, cf.email], pageSize: chunk.length },
      );
      recs.forEach((r) =>
        map.set(r.id, {
          id: r.id,
          name: String(r.fields[cf.name] ?? ""),
          phone: opt(r.fields[cf.phone]),
          email: opt(r.fields[cf.email]),
        }),
      );
    }
    return map;
  },

  /** Find one contact by email (case-insensitive), or null. */
  async findByEmail(email: string): Promise<OpportunityContact | null> {
    const e = escapeFormulaValue(email.trim().toLowerCase());
    if (!e) return null;
    const recs = await airtable.listAll<Record<string, unknown>>(
      tables.opportunityContacts,
      { filterByFormula: `LOWER({${cf.email}})='${e}'`, pageSize: 1, maxRecords: 1 },
    );
    const r = recs[0];
    return r
      ? {
          id: r.id,
          name: String(r.fields[cf.name] ?? ""),
          email: opt(r.fields[cf.email]),
          phone: opt(r.fields[cf.phone]),
          ghlContactId: opt(r.fields[cf.ghlContactId]),
        }
      : null;
  },

  async create(input: {
    name: string;
    email?: string;
    phone?: string;
    ghlContactId?: string;
  }): Promise<OpportunityContact> {
    const fields: Record<string, unknown> = { [cf.name]: input.name };
    if (input.email) fields[cf.email] = input.email;
    if (input.phone) fields[cf.phone] = input.phone;
    if (input.ghlContactId) fields[cf.ghlContactId] = input.ghlContactId;
    const rec = await airtable.create<Record<string, unknown>>(
      tables.opportunityContacts,
      fields,
    );
    return {
      id: rec.id,
      name: String(rec.fields[cf.name] ?? ""),
      email: opt(rec.fields[cf.email]),
      phone: opt(rec.fields[cf.phone]),
      ghlContactId: opt(rec.fields[cf.ghlContactId]),
    };
  },
};
