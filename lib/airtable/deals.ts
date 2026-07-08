import "server-only";

import { ghlContactUrl } from "@/lib/ghl";
import { daysSince } from "@/lib/leads/cadence";
import { airtable, type AirtableRecord } from "./client";
import { opportunityFields, tables } from "./mapping";
import { prependNote } from "./notes";
import { OpportunityContactsRepo } from "./opportunity-contacts";
import type { DealRow } from "./types";

const f = opportunityFields;
type OppFields = Record<string, unknown>;

function opt(v: unknown): string | undefined {
  if (Array.isArray(v)) return v[0] == null ? undefined : String(v[0]);
  if (v === undefined || v === null || v === "") return undefined;
  return String(v);
}
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function firstLinkId(v: unknown): string | undefined {
  return Array.isArray(v) && v.length > 0 ? String(v[0]) : undefined;
}

function isFuture(iso: string | undefined): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return !Number.isNaN(t) && t > Date.now();
}

function toDeal(rec: AirtableRecord<OppFields>, contactName?: string): DealRow {
  const r = rec.fields;
  const followUpAt = opt(r[f.salesFollowUpAt]);
  const sentDate = opt(r[f.proposalSentDate]) ?? "";
  return {
    id: rec.id,
    name: contactName || String(r[f.name] ?? "") || "(unnamed)",
    amount: num(r[f.proposalAmount]),
    sentDate,
    daysOut: daysSince(sentDate || undefined),
    estimator: opt(r[f.estimator]) ?? "",
    source: opt(r[f.source]) ?? "",
    jobType: opt(r[f.jobType]) ?? "",
    followUpAt,
    waiting: isFuture(followUpAt),
    notes: opt(r[f.notes]),
    phone: opt(r[f.phoneFromContact]),
    email: opt(r[f.matchEmail]) ?? opt(r[f.emailFromContact]),
    ghlUrl: ghlContactUrl(opt(r[f.ghlContactId])),
  };
}

export const DealsRepo = {
  /**
   * Every open (pending) proposal — sent but not yet won or lost. Needs-action
   * deals first (no follow-up scheduled, or it has arrived), oldest proposal
   * first so the stalest deal is on top; the Waiting section sorts by soonest
   * follow-up.
   */
  async listOpen(): Promise<DealRow[]> {
    const recs = await airtable.listAll<OppFields>(tables.opportunities, {
      filterByFormula:
        `AND(` +
        `OR({${f.proposalSent}}=1,{${f.proposalSentDate}}!='')` +
        `,OR({${f.saleOutcome}}='Pending',{${f.saleOutcome}}='')` +
        `)`,
    });
    const ids = recs
      .map((r) => firstLinkId(r.fields[f.contact]))
      .filter((v): v is string => Boolean(v));
    const byId = ids.length ? await OpportunityContactsRepo.byIds(ids) : new Map();
    const deals = recs.map((rec) => {
      const cid = firstLinkId(rec.fields[f.contact]);
      return toDeal(rec, cid ? byId.get(cid)?.name : undefined);
    });
    return deals.sort((a, b) => {
      if (a.waiting !== b.waiting) return a.waiting ? 1 : -1;
      if (a.waiting) return (a.followUpAt ?? "").localeCompare(b.followUpAt ?? "");
      return (b.daysOut ?? 0) - (a.daysOut ?? 0);
    });
  },

  /** Schedule (or clear, with null) the salesman's next check-in on a deal. */
  async setFollowUp(id: string, by: string, followUpAt: string | null): Promise<DealRow> {
    const updated = await airtable.update<OppFields>(tables.opportunities, id, {
      [f.salesFollowUpAt]: followUpAt,
      [f.lastAction]: followUpAt ? "sales-follow-up" : "sales-follow-up-clear",
      [f.lastActionBy]: by,
      [f.lastActionAt]: new Date().toISOString(),
    });
    return toDeal(updated);
  },

  /** Prepend a dated check-in note to the deal's notes. */
  async addNote(id: string, by: string, note: string): Promise<DealRow> {
    const rec = await airtable.get<OppFields>(tables.opportunities, id);
    const updated = await airtable.update<OppFields>(tables.opportunities, id, {
      [f.notes]: prependNote(rec.fields[f.notes], note),
      [f.lastAction]: "sales-note",
      [f.lastActionBy]: by,
      [f.lastActionAt]: new Date().toISOString(),
    });
    return toDeal(updated);
  },

  /**
   * Close a deal from the board. The reconcile proposal sweep only flags a
   * mismatch when PaintScout has a DEFINITIVE status (accepted/declined) that
   * disagrees, so closing here while PaintScout still shows the quote open is
   * quiet — see expectedOutcome in lib/reconcile/proposals.ts.
   */
  async markWon(id: string, by: string, amount?: number): Promise<DealRow> {
    const rec = await airtable.get<OppFields>(tables.opportunities, id);
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
    const updated = await airtable.update<OppFields>(tables.opportunities, id, {
      [f.saleOutcome]: "Won",
      [f.wonAmount]: amount ?? num(rec.fields[f.proposalAmount]),
      [f.dateOfSale]: today,
      [f.salesFollowUpAt]: null,
      [f.lastAction]: "sales-won",
      [f.lastActionBy]: by,
      [f.lastActionAt]: new Date().toISOString(),
    });
    return toDeal(updated);
  },

  async markLost(id: string, by: string, reason: string): Promise<DealRow> {
    const updated = await airtable.update<OppFields>(tables.opportunities, id, {
      [f.saleOutcome]: "Lost",
      [f.reasonLost]: reason,
      [f.lostAt]: new Date().toISOString(),
      [f.salesFollowUpAt]: null,
      [f.lastAction]: "sales-lost",
      [f.lastActionBy]: by,
      [f.lastActionAt]: new Date().toISOString(),
    });
    return toDeal(updated);
  },
};
