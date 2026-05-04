import "server-only";

import { airtable, type AirtableRecord } from "./client";
import { contactFields, tables } from "./mapping";
import type { Contact } from "./types";

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
    const records = await airtable.listAll<ContactAirtableFields>(tables.contacts);
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
    const rec = await airtable.get<ContactAirtableFields>(tables.contacts, id);
    return fromRecord(rec);
  },

  async create(input: CreateContactInput): Promise<Contact> {
    const fields: Record<string, unknown> = {
      [contactFields.firstName]: input.firstName,
      [contactFields.lastName]: input.lastName,
    };
    if (input.email) fields[contactFields.email] = input.email;
    if (input.phone) fields[contactFields.phone] = input.phone;
    if (input.street) fields[contactFields.street] = input.street;
    if (input.city) fields[contactFields.city] = input.city;
    if (input.state) fields[contactFields.state] = input.state;
    if (input.zip) fields[contactFields.zip] = input.zip;
    const rec = await airtable.create<ContactAirtableFields>(tables.contacts, fields);
    return fromRecord(rec);
  },
};
