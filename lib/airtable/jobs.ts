import "server-only";

import { airtable, type AirtableRecord } from "./client";
import { jobFields, tables } from "./mapping";
import type { Job, JobStatus, ProjectType } from "./types";

type JobAirtableFields = Record<string, unknown>;

function firstString(v: unknown): string | undefined {
  if (Array.isArray(v)) {
    const first = v[0];
    return first === undefined || first === null ? undefined : String(first);
  }
  if (v === undefined || v === null || v === "") return undefined;
  return String(v);
}

function firstLinkId(v: unknown): string | undefined {
  return Array.isArray(v) && v.length > 0 ? String(v[0]) : undefined;
}

function fromRecord(rec: AirtableRecord<JobAirtableFields>): Job {
  const f = rec.fields;
  return {
    id: rec.id,
    name: String(f[jobFields.name] ?? ""),
    jobNumber: firstString(f[jobFields.jobNumber]),
    customerId: firstLinkId(f[jobFields.customer]),
    customerName: firstString(f[jobFields.customerName]),
    address: firstString(f[jobFields.address]),
    status: firstString(f[jobFields.status]) as JobStatus | undefined,
    projectType: firstString(f[jobFields.projectType]) as ProjectType | undefined,
    scheduledStart: firstString(f[jobFields.scheduledStart]),
    scheduledEnd: firstString(f[jobFields.scheduledEnd]),
    assignedSubId: firstLinkId(f[jobFields.assignedSub]),
    notes: firstString(f[jobFields.notes]),
    emailSent: Boolean(f[jobFields.emailSent]),
    customerReplied: Boolean(f[jobFields.customerReplied]),
    colorsReceived: Boolean(f[jobFields.colorsReceived]),
    workOrderUrl: firstString(f[jobFields.workOrderUrl]),
    workOrderReady: Boolean(f[jobFields.workOrderReady]),
  };
}

/**
 * Coerce an inbound value into what Airtable expects for the corresponding field.
 * `undefined` means "don't touch this field". `null` means "clear it" — Airtable
 * accepts null to clear linked records and dates, which the previous "" hack did not.
 */
type JobPatch = Partial<{
  jobNumber: string | null;
  customerId: string | null;
  status: JobStatus | null;
  projectType: ProjectType | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  assignedSubId: string | null;
  notes: string | null;
  emailSent: boolean;
  customerReplied: boolean;
  colorsReceived: boolean;
  workOrderReady: boolean;
}>;

function toFields(patch: JobPatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.jobNumber !== undefined)
    out[jobFields.jobNumber] = patch.jobNumber ?? "";
  if (patch.customerId !== undefined)
    out[jobFields.customer] = patch.customerId ? [patch.customerId] : [];
  if (patch.status !== undefined)
    out[jobFields.status] = patch.status ?? null;
  if (patch.projectType !== undefined)
    out[jobFields.projectType] = patch.projectType ?? null;
  if (patch.scheduledStart !== undefined)
    out[jobFields.scheduledStart] = patch.scheduledStart ?? null;
  if (patch.scheduledEnd !== undefined)
    out[jobFields.scheduledEnd] = patch.scheduledEnd ?? null;
  if (patch.assignedSubId !== undefined)
    out[jobFields.assignedSub] = patch.assignedSubId ? [patch.assignedSubId] : [];
  if (patch.notes !== undefined)
    out[jobFields.notes] = patch.notes ?? "";
  if (patch.emailSent !== undefined)
    out[jobFields.emailSent] = patch.emailSent;
  if (patch.customerReplied !== undefined)
    out[jobFields.customerReplied] = patch.customerReplied;
  if (patch.colorsReceived !== undefined)
    out[jobFields.colorsReceived] = patch.colorsReceived;
  if (patch.workOrderReady !== undefined)
    out[jobFields.workOrderReady] = patch.workOrderReady;
  return out;
}

export type CreateJobInput = {
  jobNumber: string;
  customerId: string;
  projectType: ProjectType;
  status?: JobStatus;
  scheduledStart?: string;
  scheduledEnd?: string;
  assignedSubId?: string;
  notes?: string;
};

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

  async create(input: CreateJobInput): Promise<Job> {
    const rec = await airtable.create<JobAirtableFields>(tables.jobs, toFields({
      jobNumber: input.jobNumber,
      customerId: input.customerId,
      projectType: input.projectType,
      status: input.status,
      scheduledStart: input.scheduledStart,
      scheduledEnd: input.scheduledEnd,
      assignedSubId: input.assignedSubId,
      notes: input.notes,
    }));
    return fromRecord(rec);
  },

  async update(id: string, patch: JobPatch): Promise<Job> {
    const rec = await airtable.update<JobAirtableFields>(
      tables.jobs,
      id,
      toFields(patch),
    );
    return fromRecord(rec);
  },

  async delete(id: string): Promise<void> {
    await airtable.delete(tables.jobs, id);
  },
};
