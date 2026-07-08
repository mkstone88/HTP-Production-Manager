// Resolve duplicate records found by the duplicates sweep. Destructive: it
// deletes the extra records. For contacts it first re-links their opportunities
// to the survivor so no funnel data is orphaned.
import "server-only";

import { airtable } from "@/lib/airtable/client";
import { opportunityContactFields, opportunityFields, tables } from "@/lib/airtable/mapping";

export type ResolveResult = { removed: number; relinked: number };

/** Delete duplicate opportunities, keeping `keepId`. */
export async function resolveOpportunityDuplicates(
  keepId: string,
  removeIds: string[],
): Promise<ResolveResult> {
  let removed = 0;
  for (const id of removeIds) {
    if (id === keepId) continue;
    await airtable.delete(tables.opportunities, id);
    removed++;
  }
  return { removed, relinked: 0 };
}

/**
 * Merge duplicate contacts into `keepId`: move every opportunity linked to a
 * duplicate onto the survivor, then delete the duplicate. Nothing is orphaned.
 */
export async function resolveContactDuplicates(
  keepId: string,
  removeIds: string[],
): Promise<ResolveResult> {
  let removed = 0;
  let relinked = 0;
  for (const id of removeIds) {
    if (id === keepId) continue;
    const contact = await airtable.get<Record<string, unknown>>(
      tables.opportunityContacts,
      id,
    );
    const oppLinks = contact.fields[opportunityContactFields.opportunities];
    const oppIds = Array.isArray(oppLinks) ? oppLinks.map(String) : [];
    for (const oppId of oppIds) {
      await airtable.update(tables.opportunities, oppId, {
        [opportunityFields.contact]: [keepId],
      });
      relinked++;
    }
    await airtable.delete(tables.opportunityContacts, id);
    removed++;
  }
  return { removed, relinked };
}
