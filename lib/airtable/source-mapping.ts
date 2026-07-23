import "server-only";

import { airtable } from "./client";
import { escapeFormulaValue } from "./formula";
import { sourceMappingFields, tables } from "./mapping";

const sf = sourceMappingFields;


export const SourceMappingRepo = {
  /**
   * Save (or update) a raw-value → canonical-source alias so future leads with
   * this raw value normalize automatically.
   */
  async upsert(rawValue: string, canonical: string): Promise<void> {
    const raw = rawValue.trim();
    if (!raw) return;
    const existing = await airtable.listAll<Record<string, unknown>>(
      tables.sourceMapping,
      {
        filterByFormula: `LOWER({${sf.rawValue}})='${escapeFormulaValue(raw.toLowerCase())}'`,
        pageSize: 1,
        maxRecords: 1,
      },
    );
    if (existing[0]) {
      await airtable.update(tables.sourceMapping, existing[0].id, {
        [sf.canonicalSource]: canonical,
      });
    } else {
      await airtable.create(tables.sourceMapping, {
        [sf.rawValue]: raw,
        [sf.canonicalSource]: canonical,
      });
    }
  },
};
