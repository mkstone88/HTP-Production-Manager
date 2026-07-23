import "server-only";

import { airtable, type AirtableRecord } from "./client";
import { escapeFormulaValue } from "./formula";
import { marketingSpendFields, tables } from "./mapping";
import type {
  MarketingSpendInput,
  MarketingSpendMonthInput,
  MarketingSpendRow,
} from "./types";

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
      filterByFormula: `AND(DATETIME_FORMAT({${f.month}}, 'YYYY-MM')='${input.month}', {${f.source}}='${escapeFormulaValue(input.source)}')`,
      pageSize: 2,
      maxRecords: 2,
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

  /**
   * Month-end batch: set several sources' amounts for one month in a single
   * call. Reads the month's existing rows once, then updates or creates per
   * source — amounts-only, so notes (e.g. from the Google Ads pull) survive
   * corrections. Sources not in `entries` are left untouched.
   */
  async upsertMonth(input: MarketingSpendMonthInput): Promise<MarketingSpendRow[]> {
    const existing = await airtable.listAll<SpendFields>(tables.marketingSpend, {
      filterByFormula: `DATETIME_FORMAT({${f.month}}, 'YYYY-MM')='${input.month}'`,
    });
    const bySource = new Map(existing.map((r) => [String(r.fields[f.source] ?? ""), r]));

    const out: MarketingSpendRow[] = [];
    for (const entry of input.entries) {
      const prior = bySource.get(entry.source);
      const rec = prior
        ? await airtable.update<SpendFields>(tables.marketingSpend, prior.id, {
            [f.amount]: entry.amount,
          })
        : await airtable.create<SpendFields>(tables.marketingSpend, {
            [f.name]: `${entry.source} — ${input.month}`,
            [f.month]: `${input.month}-01`,
            [f.source]: entry.source,
            [f.amount]: entry.amount,
          });
      out.push(fromRecord(rec));
    }
    return out;
  },
};
