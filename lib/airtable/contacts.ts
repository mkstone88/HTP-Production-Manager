import "server-only";

import { airtable, type AirtableRecord } from "./client";
import { opportunityContactFields, tables } from "./mapping";
import type { Contact } from "./types";

// The production side's "customer" is a person in the NEW - Contacts identity
// table — the same table the setter/sales side uses (via OpportunityContactsRepo).
// Jobs link to it through jobFields.customer ("NEW - Contact").
const contactFields = opportunityContactFields;
const contactsTable = tables.opportunityContacts;

type ContactAirtableFields = Record<string, unknown>;

function optString(v: unknown): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  return String(v);
}

function fromRecord(rec: AirtableRecord<ContactAirtableFields>): Contact {
  const f = rec.fields;
  return {
    id: rec.id,
    name: String(f[contactFields.name] ?? ""),
    firstName: optString(f[contactFields.firstName]),
    lastName: optString(f[contactFields.lastName]),
    email: optString(f[contactFields.email]),
    phone: optString(f[contactFields.phone]),
    street: optString(f[contactFields.street]),
    city: optString(f[contactFields.city]),
    state: optString(f[contactFields.state]),
    zip: optString(f[contactFields.zip]),
  };
}

export type CreateContactInput = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
};

export const ContactsRepo = {
  /**
   * List contacts. Used to power the customer picker on the job-create form.
   * Sorted by name. Optionally filtered with a case-insensitive substring match.
   */
  async list(filter?: { search?: string; limit?: number }): Promise<Contact[]> {
    const records = await airtable.listAll<ContactAirtableFields>(contactsTable);
    let contacts = records.map(fromRecord);
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      contacts = contacts.filter((c) =>
        [c.name, c.email, c.phone].some((v) => v?.toLowerCase().includes(q)),
      );
    }
    contacts.sort((a, b) => a.name.localeCompare(b.name));
    if (filter?.limit) contacts = contacts.slice(0, filter.limit);
    return contacts;
  },

  async get(id: string): Promise<Contact> {
    const rec = await airtable.get<ContactAirtableFields>(contactsTable, id);
    return fromRecord(rec);
  },

  async create(input: CreateContactInput): Promise<Contact> {
    // NEW - Contacts' "Full Name" is a writable field, not a formula, so set it
    // explicitly (unlike the legacy Contacts table where Name auto-computed).
    const fullName = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();
    const fields: Record<string, unknown> = {
      [contactFields.name]: fullName,
      [contactFields.firstName]: input.firstName,
      [contactFields.lastName]: input.lastName,
    };
    if (input.email) fields[contactFields.email] = input.email;
    if (input.phone) fields[contactFields.phone] = input.phone;
    if (input.street) fields[contactFields.street] = input.street;
    if (input.city) fields[contactFields.city] = input.city;
    if (input.state) fields[contactFields.state] = input.state;
    if (input.zip) fields[contactFields.zip] = input.zip;
    const rec = await airtable.create<ContactAirtableFields>(contactsTable, fields);
    return fromRecord(rec);
  },
};
