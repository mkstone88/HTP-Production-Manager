import "server-only";

import { airtable, type AirtableRecord } from "./client";
import { materialsExpenseFields, tables } from "./mapping";
import type { MaterialsExpense } from "./types";

type MaterialsAirtableFields = Record<string, unknown>;

function optString(v: unknown): string | undefined {
  if (Array.isArray(v)) {
    const first = v[0];
    return first === undefined || first === null ? undefined : String(first);
  }
  if (v === undefined || v === null || v === "") return undefined;
  return String(v);
}

function optNumber(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function firstLinkId(v: unknown): string | undefined {
  return Array.isArray(v) && v.length > 0 ? String(v[0]) : undefined;
}

function fromRecord(rec: AirtableRecord<MaterialsAirtableFields>): MaterialsExpense {
  const f = rec.fields;
  return {
    id: rec.id,
    name: String(f[materialsExpenseFields.name] ?? ""),
    vendor: optString(f[materialsExpenseFields.vendor]),
    invoiceDate: optString(f[materialsExpenseFields.invoiceDate]),
    invoiceNumber: optString(f[materialsExpenseFields.invoiceNumber]),
    po: optString(f[materialsExpenseFields.po]),
    projectId: firstLinkId(f[materialsExpenseFields.project]),
    invoiceTotal: optNumber(f[materialsExpenseFields.invoiceTotal]),
    gallons: optNumber(f[materialsExpenseFields.gallons]),
    totalSupplies: optNumber(f[materialsExpenseFields.totalSupplies]),
    totalPaint: optNumber(f[materialsExpenseFields.totalPaint]),
  };
}

/**
 * `undefined` leaves a field untouched; `null` clears it. `projectId` is written
 * as a linked-record array (empty array unassigns the invoice).
 */
type MaterialsPatch = Partial<{
  vendor: string | null;
  invoiceDate: string | null;
  invoiceNumber: string | null;
  po: string | null;
  projectId: string | null;
  invoiceTotal: number | null;
  gallons: number | null;
  totalSupplies: number | null;
  totalPaint: number | null;
}>;

function toFields(patch: MaterialsPatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.vendor !== undefined)
    out[materialsExpenseFields.vendor] = patch.vendor ?? null;
  if (patch.invoiceDate !== undefined)
    out[materialsExpenseFields.invoiceDate] = patch.invoiceDate ?? null;
  if (patch.invoiceNumber !== undefined)
    out[materialsExpenseFields.invoiceNumber] = patch.invoiceNumber ?? "";
  if (patch.po !== undefined)
    out[materialsExpenseFields.po] = patch.po ?? "";
  if (patch.projectId !== undefined)
    out[materialsExpenseFields.project] = patch.projectId ? [patch.projectId] : [];
  if (patch.invoiceTotal !== undefined)
    out[materialsExpenseFields.invoiceTotal] = patch.invoiceTotal ?? null;
  if (patch.gallons !== undefined)
    out[materialsExpenseFields.gallons] = patch.gallons ?? null;
  if (patch.totalSupplies !== undefined)
    out[materialsExpenseFields.totalSupplies] = patch.totalSupplies ?? null;
  if (patch.totalPaint !== undefined)
    out[materialsExpenseFields.totalPaint] = patch.totalPaint ?? null;
  return out;
}

export type CreateMaterialsExpenseInput = {
  vendor?: string;
  invoiceDate?: string;
  invoiceNumber?: string;
  po?: string;
  projectId?: string;
  invoiceTotal?: number;
  gallons?: number;
  totalSupplies?: number;
  totalPaint?: number;
};

export const MaterialsRepo = {
  /**
   * List invoices, newest first. `unassigned` returns only invoices with no
   * Project link (the ones still needing to be matched to a job).
   */
  async list(filter?: {
    unassigned?: boolean;
    projectId?: string;
  }): Promise<MaterialsExpense[]> {
    const records = await airtable.listAll<MaterialsAirtableFields>(
      tables.materialsExpenses,
    );
    let items = records.map(fromRecord);
    if (filter?.unassigned) items = items.filter((m) => !m.projectId);
    if (filter?.projectId) items = items.filter((m) => m.projectId === filter.projectId);
    items.sort((a, b) => (b.invoiceDate ?? "").localeCompare(a.invoiceDate ?? ""));
    return items;
  },

  /** Count of invoices not yet assigned to a job. Powers the costing warning banner. */
  async unassignedCount(): Promise<number> {
    const items = await MaterialsRepo.list({ unassigned: true });
    return items.length;
  },

  async get(id: string): Promise<MaterialsExpense> {
    const rec = await airtable.get<MaterialsAirtableFields>(
      tables.materialsExpenses,
      id,
    );
    return fromRecord(rec);
  },

  async create(input: CreateMaterialsExpenseInput): Promise<MaterialsExpense> {
    const rec = await airtable.create<MaterialsAirtableFields>(
      tables.materialsExpenses,
      toFields(input),
    );
    return fromRecord(rec);
  },

  async update(id: string, patch: MaterialsPatch): Promise<MaterialsExpense> {
    const rec = await airtable.update<MaterialsAirtableFields>(
      tables.materialsExpenses,
      id,
      toFields(patch),
    );
    return fromRecord(rec);
  },

  async delete(id: string): Promise<void> {
    await airtable.delete(tables.materialsExpenses, id);
  },
};
