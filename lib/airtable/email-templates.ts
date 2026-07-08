import "server-only";

import { airtable, type AirtableRecord } from "./client";
import { emailTemplateFields, tables } from "./mapping";
import type { EmailTemplate, EmailTemplateInput } from "./types";

const f = emailTemplateFields;
type Fields = Record<string, unknown>;

function fromRecord(rec: AirtableRecord<Fields>): EmailTemplate {
  return {
    id: rec.id,
    name: String(rec.fields[f.name] ?? ""),
    subject: String(rec.fields[f.subject] ?? ""),
    body: String(rec.fields[f.body] ?? ""),
  };
}

function toFields(input: Partial<EmailTemplateInput>): Fields {
  const out: Fields = {};
  if (input.name !== undefined) out[f.name] = input.name;
  if (input.subject !== undefined) out[f.subject] = input.subject;
  if (input.body !== undefined) out[f.body] = input.body;
  return out;
}

export const EmailTemplatesRepo = {
  async list(): Promise<EmailTemplate[]> {
    const recs = await airtable.listAll<Fields>(tables.emailTemplates, {
      sort: [{ field: f.name }],
    });
    return recs.map(fromRecord);
  },

  async create(input: EmailTemplateInput): Promise<EmailTemplate> {
    const rec = await airtable.create<Fields>(tables.emailTemplates, toFields(input));
    return fromRecord(rec);
  },

  async update(id: string, input: Partial<EmailTemplateInput>): Promise<EmailTemplate> {
    const rec = await airtable.update<Fields>(tables.emailTemplates, id, toFields(input));
    return fromRecord(rec);
  },

  async remove(id: string): Promise<void> {
    await airtable.delete(tables.emailTemplates, id);
  },
};
