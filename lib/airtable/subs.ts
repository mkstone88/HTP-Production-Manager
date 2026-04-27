import "server-only";

import { airtable, type AirtableRecord } from "./client";
import { subFields, tables } from "./mapping";
import type { Sub } from "./types";

type SubAirtableFields = {
  [K in keyof typeof subFields]?: unknown;
};

function fromRecord(rec: AirtableRecord<Record<string, unknown>>): Sub {
  const f = rec.fields;
  return {
    id: rec.id,
    name: String(f[subFields.name] ?? ""),
    contactName: optString(f[subFields.contactName]),
    phone: optString(f[subFields.phone]),
    email: optString(f[subFields.email]),
    trade: optString(f[subFields.trade]),
    active: f[subFields.active] === undefined ? undefined : Boolean(f[subFields.active]),
    notes: optString(f[subFields.notes]),
  };
}

function optString(v: unknown): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  return String(v);
}

function toFields(patch: Partial<Sub>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.name !== undefined) out[subFields.name] = patch.name;
  if (patch.contactName !== undefined) out[subFields.contactName] = patch.contactName;
  if (patch.phone !== undefined) out[subFields.phone] = patch.phone;
  if (patch.email !== undefined) out[subFields.email] = patch.email;
  if (patch.trade !== undefined) out[subFields.trade] = patch.trade;
  if (patch.active !== undefined) out[subFields.active] = patch.active;
  if (patch.notes !== undefined) out[subFields.notes] = patch.notes;
  return out;
}

export const SubsRepo = {
  async list(filter?: { activeOnly?: boolean }): Promise<Sub[]> {
    const records = await airtable.listAll<SubAirtableFields>(tables.subs);
    let subs = records.map(fromRecord);
    if (filter?.activeOnly) subs = subs.filter((s) => s.active !== false);
    return subs.sort((a, b) => a.name.localeCompare(b.name));
  },

  async get(id: string): Promise<Sub> {
    const rec = await airtable.get<SubAirtableFields>(tables.subs, id);
    return fromRecord(rec);
  },

  async create(input: Omit<Sub, "id">): Promise<Sub> {
    const rec = await airtable.create<SubAirtableFields>(
      tables.subs,
      toFields(input) as Partial<SubAirtableFields>,
    );
    return fromRecord(rec);
  },

  async update(id: string, patch: Partial<Omit<Sub, "id">>): Promise<Sub> {
    const rec = await airtable.update<SubAirtableFields>(
      tables.subs,
      id,
      toFields(patch) as Partial<SubAirtableFields>,
    );
    return fromRecord(rec);
  },

  async delete(id: string): Promise<void> {
    await airtable.delete(tables.subs, id);
  },
};
