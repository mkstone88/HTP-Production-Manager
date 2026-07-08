import "server-only";

import { computeNextFollowUp, daysSince, queueState } from "@/lib/leads/cadence";
import { ghlContactUrl } from "@/lib/ghl";
import { airtable, type AirtableRecord } from "./client";
import { prependNote } from "./notes";
import { opportunityFields, tables } from "./mapping";
import { OpportunityContactsRepo } from "./opportunity-contacts";
import type { DisqualifyReason, Lead } from "./types";

const f = opportunityFields;
type OppFields = Record<string, unknown>;

const now = () => new Date().toISOString();

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
function escapeFormula(v: string): string {
  return v.replace(/'/g, "\\'");
}

/** Build the client-facing Lead from a record + an optional enriched contact name. */
function toLead(rec: AirtableRecord<OppFields>, contactName?: string): Lead {
  const r = rec.fields;
  const createdAt = opt(r[f.leadCreatedAt]) ?? rec.createdTime;
  const oppName = String(r[f.name] ?? "") || "(unnamed)";
  const cadence = {
    contactAttempts: num(r[f.contactAttempts]),
    firstContactedAt: opt(r[f.firstContactedAt]),
    callbackAt: opt(r[f.callbackAt]),
    nextFollowUpDate: opt(r[f.nextFollowUpDate]),
  };
  const state = queueState(cadence);
  return {
    id: rec.id,
    name: contactName || oppName,
    email: opt(r[f.matchEmail]) ?? opt(r[f.emailFromContact]),
    phone: opt(r[f.phoneFromContact]),
    source: opt(r[f.source]),
    jobType: opt(r[f.jobType]),
    status: opt(r[f.setterStatus]),
    disqualifyReason: opt(r[f.disqualifyReason]),
    notes: opt(r[f.notes]),
    createdAt,
    lastContactedAt: opt(r[f.lastContactedAt]),
    appointmentAt: opt(r[f.appointmentAt]),
    bookedAt: opt(r[f.bookedAt]),
    ...cadence,
    ageDays: daysSince(createdAt),
    overdue: state !== "waiting",
    queueState: state,
    ghlContactId: opt(r[f.ghlContactId]),
    ghlUrl: ghlContactUrl(opt(r[f.ghlContactId])),
  };
}

/** Attach contact names by batch-fetching the linked NEW - Contacts. */
async function enrich(recs: AirtableRecord<OppFields>[]): Promise<Lead[]> {
  const ids = recs
    .map((r) => firstLinkId(r.fields[f.contact]))
    .filter((v): v is string => Boolean(v));
  const byId = ids.length ? await OpportunityContactsRepo.byIds(ids) : new Map();
  return recs.map((rec) => {
    const cid = firstLinkId(rec.fields[f.contact]);
    return toLead(rec, cid ? byId.get(cid)?.name : undefined);
  });
}

/** Stamp the audit trail on any action. */
function audit(action: string, by: string): OppFields {
  return {
    [f.lastAction]: action,
    [f.lastActionBy]: by,
    [f.lastActionAt]: now(),
  };
}

/** Queue sort rank — see QueueState in lib/leads/cadence.ts. */
const STATE_RANK = { new: 0, callback: 1, decision: 2, due: 2, waiting: 3 } as const;

export type NewLeadInput = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  source: string;
  jobType?: string;
  notes?: string;
};

export type GhlImportInput = {
  ghlOpportunityId: string;
  ghlContactId?: string;
  name: string;
  email?: string;
  phone?: string;
  source?: string;
  createdAt?: string;
};

export const LeadsRepo = {
  /**
   * The work queue: Open + Reschedule Needed. Order: brand-new leads first
   * (newest on top — call them NOW), then callbacks whose time has arrived,
   * then due / decision-needed (oldest due first), then everything waiting.
   */
  async listQueue(): Promise<Lead[]> {
    const recs = await airtable.listAll<OppFields>(tables.opportunities, {
      filterByFormula: `OR({${f.setterStatus}}='Open',{${f.setterStatus}}='Reschedule Needed')`,
    });
    const leads = await enrich(recs);
    return leads.sort((a, b) => {
      const ra = STATE_RANK[a.queueState];
      const rb = STATE_RANK[b.queueState];
      if (ra !== rb) return ra - rb;
      if (ra === 0) return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
      if (ra === 1) return (a.callbackAt ?? "").localeCompare(b.callbackAt ?? "");
      const an = a.nextFollowUpDate ?? a.createdAt ?? "";
      const bn = b.nextFollowUpDate ?? b.createdAt ?? "";
      return an.localeCompare(bn);
    });
  },

  /** Recently booked appointments, newest first. */
  async listRecentlyBooked(days = 14): Promise<Lead[]> {
    const recs = await airtable.listAll<OppFields>(tables.opportunities, {
      filterByFormula: `AND({${f.setterStatus}}='Booked', IS_AFTER({${f.bookedAt}}, DATEADD(NOW(), -${days}, 'days')))`,
      sort: [{ field: f.bookedAt, direction: "desc" }],
    });
    return enrich(recs);
  },

  async get(id: string): Promise<Lead> {
    const rec = await airtable.get<OppFields>(tables.opportunities, id);
    const cid = firstLinkId(rec.fields[f.contact]);
    const name = cid ? (await OpportunityContactsRepo.byIds([cid])).get(cid)?.name : undefined;
    return toLead(rec, name);
  },

  /**
   * Log a contact attempt: bump the counter, schedule the next touch relative
   * to NOW, clear any pending callback (it just happened), and optionally
   * prepend a dated call note.
   */
  async markContacted(id: string, by: string, note?: string): Promise<Lead> {
    const rec = await airtable.get<OppFields>(tables.opportunities, id);
    const attempts = num(rec.fields[f.contactAttempts]) + 1;
    const fields: OppFields = {
      ...audit("contacted", by),
      [f.contactAttempts]: attempts,
      [f.lastContactedAt]: now(),
      [f.nextFollowUpDate]: computeNextFollowUp(attempts),
      [f.callbackAt]: null,
    };
    if (!rec.fields[f.firstContactedAt]) fields[f.firstContactedAt] = now();
    if (note?.trim()) fields[f.notes] = prependNote(rec.fields[f.notes], note);
    const updated = await airtable.update<OppFields>(tables.opportunities, id, fields);
    return toLead(updated);
  },

  /**
   * Customer asked to be contacted at a specific time. Overrides the cadence:
   * the lead sleeps until then, then surfaces at the top of the queue (right
   * below brand-new leads). Cleared by the next logged contact.
   */
  async scheduleCallback(id: string, by: string, callbackAt: string, note?: string): Promise<Lead> {
    const fields: OppFields = {
      ...audit("callback", by),
      [f.callbackAt]: callbackAt,
      [f.nextFollowUpDate]: callbackAt,
    };
    if (note?.trim()) {
      const rec = await airtable.get<OppFields>(tables.opportunities, id);
      fields[f.notes] = prependNote(rec.fields[f.notes], note);
    }
    const updated = await airtable.update<OppFields>(tables.opportunities, id, fields);
    return toLead(updated);
  },

  /** Prepend a dated note without logging a contact attempt. */
  async addNote(id: string, by: string, note: string): Promise<Lead> {
    const rec = await airtable.get<OppFields>(tables.opportunities, id);
    const updated = await airtable.update<OppFields>(tables.opportunities, id, {
      ...audit("note", by),
      [f.notes]: prependNote(rec.fields[f.notes], note),
    });
    return toLead(updated);
  },

  async book(id: string, by: string, appointmentAt?: string): Promise<Lead> {
    const fields: OppFields = {
      ...audit("book", by),
      [f.setterStatus]: "Booked",
      [f.bookedAt]: now(),
      [f.nextFollowUpDate]: null,
      [f.callbackAt]: null,
    };
    if (appointmentAt) fields[f.appointmentAt] = appointmentAt;
    const updated = await airtable.update<OppFields>(tables.opportunities, id, fields);
    return toLead(updated);
  },

  /** Correct the appointment time on an already-booked lead. */
  async setAppointment(id: string, by: string, appointmentAt: string): Promise<Lead> {
    const updated = await airtable.update<OppFields>(tables.opportunities, id, {
      ...audit("set-appointment", by),
      [f.appointmentAt]: appointmentAt,
    });
    return toLead(updated);
  },

  async disqualify(id: string, reason: DisqualifyReason, by: string): Promise<Lead> {
    const updated = await airtable.update<OppFields>(tables.opportunities, id, {
      ...audit("disqualify", by),
      [f.setterStatus]: "Disqualified",
      [f.disqualifyReason]: reason,
      [f.disqualifiedAt]: now(),
      [f.nextFollowUpDate]: null,
      [f.callbackAt]: null,
    });
    return toLead(updated);
  },

  async abandon(id: string, by: string): Promise<Lead> {
    const updated = await airtable.update<OppFields>(tables.opportunities, id, {
      ...audit("abandon", by),
      [f.setterStatus]: "Abandoned",
      [f.abandonedAt]: now(),
      [f.nextFollowUpDate]: null,
      [f.callbackAt]: null,
    });
    return toLead(updated);
  },

  async reschedule(id: string, by: string): Promise<Lead> {
    const updated = await airtable.update<OppFields>(tables.opportunities, id, {
      ...audit("reschedule", by),
      [f.setterStatus]: "Reschedule Needed",
    });
    return toLead(updated);
  },

  /** Bring a booked/disqualified/abandoned lead back into the queue, due now. */
  async reopen(id: string, by: string): Promise<Lead> {
    const updated = await airtable.update<OppFields>(tables.opportunities, id, {
      ...audit("reopen", by),
      [f.setterStatus]: "Open",
      [f.nextFollowUpDate]: now(),
      [f.callbackAt]: null,
    });
    return toLead(updated);
  },

  /** Find leads across ALL statuses by name, email, or phone (min 2 chars). */
  async search(q: string): Promise<Lead[]> {
    const needle = escapeFormula(q.trim().toLowerCase());
    const recs = await airtable.listAll<OppFields>(tables.opportunities, {
      filterByFormula:
        `OR(` +
        `SEARCH('${needle}', LOWER({${f.name}}))` +
        `,SEARCH('${needle}', LOWER({${f.matchEmail}}&''))` +
        `,SEARCH('${needle}', LOWER(ARRAYJOIN({${f.emailFromContact}})))` +
        `,SEARCH('${needle}', ARRAYJOIN({${f.phoneFromContact}}))` +
        `)`,
      sort: [{ field: f.leadCreatedAt, direction: "desc" }],
      maxRecords: 25,
    });
    return enrich(recs);
  },

  async remove(id: string): Promise<void> {
    await airtable.delete(tables.opportunities, id);
  },

  /** Manual intake: find-or-create the contact, then an Open opportunity. */
  async create(input: NewLeadInput, by: string): Promise<Lead> {
    const email = input.email?.trim();
    const fullName =
      [input.firstName, input.lastName].filter(Boolean).join(" ").trim() ||
      email ||
      input.phone ||
      "Unknown";

    let contact = email ? await OpportunityContactsRepo.findByEmail(email) : null;
    if (!contact) {
      contact = await OpportunityContactsRepo.create({
        name: fullName,
        email,
        phone: input.phone,
      });
    }

    const createdAt = now();
    const oppName = `${fullName} — ${input.source} — ${createdAt.slice(0, 10)}`;
    const rec = await airtable.create<OppFields>(tables.opportunities, {
      [f.name]: oppName,
      [f.contact]: [contact.id],
      [f.matchEmail]: email,
      [f.source]: input.source,
      [f.rawSource]: input.source,
      [f.captureMethod]: "Manual Entry",
      [f.jobType]: input.jobType,
      [f.setterStatus]: "Open",
      [f.leadCreatedAt]: createdAt,
      [f.nextFollowUpDate]: computeNextFollowUp(0), // due immediately — speed-to-lead
      [f.notes]: input.notes,
      ...audit("create", by),
    });
    return toLead(rec, contact.name);
  },

  /** Import a missed GHL lead into Airtable as an Open opportunity. */
  async importFromGhl(input: GhlImportInput, by: string): Promise<Lead> {
    const email = input.email?.trim();
    let contact = email ? await OpportunityContactsRepo.findByEmail(email) : null;
    if (!contact) {
      contact = await OpportunityContactsRepo.create({
        name: input.name || email || input.phone || "Unknown",
        email,
        phone: input.phone,
        ghlContactId: input.ghlContactId,
      });
    }

    const createdAt = input.createdAt || now();
    const oppName = `${input.name || email || "Lead"} — ${input.source || "Needs Review"} — ${createdAt.slice(0, 10)}`;
    const rec = await airtable.create<OppFields>(tables.opportunities, {
      [f.name]: oppName,
      [f.contact]: [contact.id],
      [f.matchEmail]: email,
      [f.source]: input.source || "Needs Review",
      [f.rawSource]: input.source,
      [f.captureMethod]: "Reconciliation",
      [f.ghlOpportunityId]: input.ghlOpportunityId,
      [f.ghlContactId]: input.ghlContactId,
      [f.setterStatus]: "Open",
      [f.leadCreatedAt]: createdAt,
      [f.nextFollowUpDate]: computeNextFollowUp(0), // due immediately — speed-to-lead
      ...audit("import", by),
    });
    return toLead(rec, contact.name);
  },

  /** Whether an opportunity already exists for a GHL opportunity id (idempotent import). */
  async existsByGhlId(ghlOpportunityId: string): Promise<boolean> {
    const g = escapeFormula(ghlOpportunityId);
    if (!g) return false;
    const recs = await airtable.listAll<OppFields>(tables.opportunities, {
      filterByFormula: `{${f.ghlOpportunityId}}='${g}'`,
      pageSize: 1,
    });
    return recs.length > 0;
  },
};
