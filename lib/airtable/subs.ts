import "server-only";

import { airtable, type AirtableRecord } from "./client";
import { subFields, tables } from "./mapping";
import type { Sub, SubStatus } from "./types";

type SubAirtableFields = Record<string, unknown>;

function optString(v: unknown): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  return String(v);
}

function fromRecord(rec: AirtableRecord<SubAirtableFields>): Sub {
  const f = rec.fields;
  return {
    id: rec.id,
    name: String(f[subFields.name] ?? ""),
    contactName: optString(f[subFields.contactName]),
    phone: optString(f[subFields.phone]),
    email: optString(f[subFields.email]),
    status: optString(f[subFields.status]) as SubStatus | undefined,
    color: optString(f[subFields.color]),
    notes: optString(f[subFields.notes]),
    insuranceExpiration: optString(f[subFields.insuranceExpiration]),
    workersCompExpiration: optString(f[subFields.workersCompExpiration]),
  };
}

type SubPatch = Partial<{
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  status: SubStatus | null;
  color: string | null;
  notes: string | null;
  insuranceExpiration: string | null;
  workersCompExpiration: string | null;
}>;

function toFields(patch: SubPatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.name !== undefined) out[subFields.name] = patch.name;
  if (patch.contactName !== undefined)
    out[subFields.contactName] = patch.contactName ?? "";
  if (patch.phone !== undefined) out[subFields.phone] = patch.phone ?? "";
  if (patch.email !== undefined) out[subFields.email] = patch.email ?? "";
  if (patch.status !== undefined) out[subFields.status] = patch.status ?? null;
  if (patch.color !== undefined) out[subFields.color] = patch.color ?? "";
  if (patch.notes !== undefined) out[subFields.notes] = patch.notes ?? "";
  if (patch.insuranceExpiration !== undefined)
    out[subFields.insuranceExpiration] = patch.insuranceExpiration ?? null;
  if (patch.workersCompExpiration !== undefined)
    out[subFields.workersCompExpiration] = patch.workersCompExpiration ?? null;
  return out;
}

export type CreateSubInput = {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  status?: SubStatus;
  color?: string;
  notes?: string;
  insuranceExpiration?: string;
  workersCompExpiration?: string;
};

export const SubsRepo = {
  async list(filter?: { activeOnly?: boolean }): Promise<Sub[]> {
    const records = await airtable.listAll<SubAirtableFields>(tables.subs);
    let subs = records.map(fromRecord);
    if (filter?.activeOnly) {
      subs = subs.filter((s) => s.status === "Active");
    }
    return subs.sort((a, b) => a.name.localeCompare(b.name));
  },

  async get(id: string): Promise<Sub> {
    const rec = await airtable.get<SubAirtableFields>(tables.subs, id);
    return fromRecord(rec);
  },

  async create(input: CreateSubInput): Promise<Sub> {
    const rec = await airtable.create<SubAirtableFields>(tables.subs, toFields(input));
    return fromRecord(rec);
  },

  async update(id: string, patch: SubPatch): Promise<Sub> {
    const rec = await airtable.update<SubAirtableFields>(
      tables.subs,
      id,
      toFields(patch),
    );
    return fromRecord(rec);
  },

  async delete(id: string): Promise<void> {
    await airtable.delete(tables.subs, id);
  },
};
