import "server-only";

import { airtable, type AirtableRecord } from "./client";
import { jobFields, tables } from "./mapping";
import type { Job } from "./types";

type JobAirtableFields = {
  [K in keyof typeof jobFields]?: unknown;
};

function fromRecord(rec: AirtableRecord<Record<string, unknown>>): Job {
  const f = rec.fields;
  const link = f[jobFields.assignedSub];
  const assignedSubId = Array.isArray(link) && link.length > 0 ? String(link[0]) : undefined;

  return {
    id: rec.id,
    name: String(f[jobFields.name] ?? ""),
    client: optString(f[jobFields.client]),
    address: optString(f[jobFields.address]),
    status: optString(f[jobFields.status]),
    scheduledStart: optString(f[jobFields.scheduledStart]),
    scheduledEnd: optString(f[jobFields.scheduledEnd]),
    assignedSubId,
    notes: optString(f[jobFields.notes]),
  };
}

function optString(v: unknown): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  return String(v);
}

function toFields(patch: Partial<Job>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.name !== undefined) out[jobFields.name] = patch.name;
  if (patch.client !== undefined) out[jobFields.client] = patch.client;
  if (patch.address !== undefined) out[jobFields.address] = patch.address;
  if (patch.status !== undefined) out[jobFields.status] = patch.status;
  if (patch.scheduledStart !== undefined)
    out[jobFields.scheduledStart] = patch.scheduledStart;
  if (patch.scheduledEnd !== undefined)
    out[jobFields.scheduledEnd] = patch.scheduledEnd;
  if (patch.assignedSubId !== undefined)
    out[jobFields.assignedSub] = patch.assignedSubId ? [patch.assignedSubId] : [];
  if (patch.notes !== undefined) out[jobFields.notes] = patch.notes;
  return out;
}

export const JobsRepo = {
  async list(filter?: {
    subId?: string;
    unscheduled?: boolean;
    unassigned?: boolean;
  }): Promise<Job[]> {
    const records = await airtable.listAll<JobAirtableFields>(tables.jobs);
    let jobs = records.map(fromRecord);
    if (filter?.subId) jobs = jobs.filter((j) => j.assignedSubId === filter.subId);
    if (filter?.unassigned) jobs = jobs.filter((j) => !j.assignedSubId);
    if (filter?.unscheduled) jobs = jobs.filter((j) => !j.scheduledStart);
    return jobs;
  },

  async get(id: string): Promise<Job> {
    const rec = await airtable.get<JobAirtableFields>(tables.jobs, id);
    return fromRecord(rec);
  },

  async create(input: Omit<Job, "id">): Promise<Job> {
    const rec = await airtable.create<JobAirtableFields>(
      tables.jobs,
      toFields(input) as Partial<JobAirtableFields>,
    );
    return fromRecord(rec);
  },

  async update(id: string, patch: Partial<Omit<Job, "id">>): Promise<Job> {
    const rec = await airtable.update<JobAirtableFields>(
      tables.jobs,
      id,
      toFields(patch) as Partial<JobAirtableFields>,
    );
    return fromRecord(rec);
  },

  async delete(id: string): Promise<void> {
    await airtable.delete(tables.jobs, id);
  },
};
