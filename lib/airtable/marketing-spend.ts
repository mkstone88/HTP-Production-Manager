import "server-only";

import { airtable, type AirtableRecord } from "./client";
import { marketingSpendFields, tables } from "./mapping";
import type { MarketingSpendInput, MarketingSpendRow } from "./types";

const f = marketingSpendFields;
type SpendFields = Record<string, unknown>;

function fromRecord(rec: AirtableRecord<SpendFields>): MarketingSpendRow {
  const r = rec.fields;
  const notes = r[f.notes];
  return {
    id: rec.id,
    // Month is a date pinned to the 1st ("2026-04-01") — expose the YYYY-MM grain.
    month: String(r[f.month] ?? "").slice(0, 7),
    source: String(r[f.source] ?? ""),
    amount: Number(r[f.amount] ?? 0) || 0,
    notes: notes === undefined || notes === null || notes === "" ? undefined : String(notes),
  };
}

function escapeFormula(v: string): string {
  return v.replace(/'/g, "\\'");
}

export const MarketingSpendRepo = {
  /** Every spend row. Small table (one row per source per month). */
  async list(): Promise<MarketingSpendRow[]> {
    const records = await airtable.listAll<SpendFields>(tables.marketingSpend);
    return records.map(fromRecord).filter((r) => r.month && r.source);
  },

  /**
   * Create or update the (source, month) cell. One row per source per month is
   * the table's invariant — this is the only writer, and it never duplicates.
   */
  async upsert(input: MarketingSpendInput): Promise<MarketingSpendRow> {
    const existing = await airtable.listAll<SpendFields>(tables.marketingSpend, {
      filterByFormula: `AND(DATETIME_FORMAT({${f.month}}, 'YYYY-MM')='${input.month}', {${f.source}}='${escapeFormula(input.source)}')`,
      pageSize: 2,
    });

    const fields: SpendFields = {
      [f.amount]: input.amount,
    };
    if (input.notes !== undefined) fields[f.notes] = input.notes;

    if (existing.length > 0) {
      const rec = await airtable.update<SpendFields>(
        tables.marketingSpend,
        existing[0].id,
        fields,
      );
      return fromRecord(rec);
    }

    const rec = await airtable.create<SpendFields>(tables.marketingSpend, {
      ...fields,
      [f.name]: `${input.source} — ${input.month}`,
      [f.month]: `${input.month}-01`,
      [f.source]: input.source,
    });
    return fromRecord(rec);
  },
};
