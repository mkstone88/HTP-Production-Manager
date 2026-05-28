import { z } from "zod";

/**
 * Airtable Status singleSelect on Projects.
 * Source of truth: the four choices in the Hometown Operations base.
 */
export const JobStatus = z.enum([
  "Proposal Accepted",
  "Scheduled",
  "In Progress",
  "Completed",
]);
export type JobStatus = z.infer<typeof JobStatus>;

export const ProjectType = z.enum([
  "Interior",
  "Exterior",
  "Cabinets",
  "Staining",
  "Exterior Painting",
  "Exterior Staining",
]);
export type ProjectType = z.infer<typeof ProjectType>;

/**
 * YYYY-MM-DD or empty/undefined. Airtable's date fields (without time) round-trip as
 * a plain date string in this format.
 */
export const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const Job = z.object({
  id: z.string(),
  name: z.string(),                         // formula on Airtable, read-only
  jobNumber: z.string().optional(),
  customerId: z.string().optional(),        // Airtable record ID of the Contact
  customerName: z.string().optional(),      // looked up via the customer link
  address: z.string().optional(),           // looked up via the customer link
  status: JobStatus.optional(),
  projectType: ProjectType.optional(),
  scheduledStart: z.string().optional(),    // YYYY-MM-DD
  scheduledEnd: z.string().optional(),      // YYYY-MM-DD
  assignedSubId: z.string().optional(),
  notes: z.string().optional(),
  // Pre-job staging flags
  emailSent: z.boolean().optional(),
  customerReplied: z.boolean().optional(),
  colorsReceived: z.boolean().optional(),
  workOrderUrl: z.string().optional(),
  workOrderReady: z.boolean().optional(),
  // Job-costing fields. projectAmount/subPayout are the only ones the app writes;
  // the rest are Airtable-computed and surfaced read-only.
  projectAmount: z.number().optional(),         // customer paid total (adjustable)
  subPayout: z.number().optional(),             // crew pay (manual entry)
  totalMaterialsExpense: z.number().optional(), // rollup of assigned invoice totals
  grossProfit: z.number().optional(),
  grossProfitPct: z.number().optional(),
  totalCogs: z.number().optional(),
  laborOverage: z.number().optional(),
  materialsOverage: z.number().optional(),
  jobCostingComplete: z.boolean().optional(),
});
export type Job = z.infer<typeof Job>;

/**
 * Steps in the order they happen during pre-job staging. Each one is either
 * a checkbox the user can toggle, or a state derived from another field.
 *
 * Add new steps here AND extend `computeStaging()` in `lib/jobs/staging.ts`.
 */
export const StagingStep = z.enum([
  "emailSent",
  "customerReplied",
  "colorsReceived",
  "workOrderReady",
  "crewAssigned",
  "scheduled",
]);
export type StagingStep = z.infer<typeof StagingStep>;

export const SubStatus = z.enum([
  "Active",
  "Onboarding",
  "Inactive",
  "Prospect",
  "Do Not Use!",
]);
export type SubStatus = z.infer<typeof SubStatus>;

/**
 * Hex color (e.g. "#0e3f86") used to tint a sub's events on the calendar.
 * Empty/undefined = fall back to a deterministic per-sub hue.
 */
export const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Expected #RRGGBB");

export const Sub = z.object({
  id: z.string(),
  name: z.string(),                         // = Company Name on Airtable
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  status: SubStatus.optional(),
  color: z.string().optional(),             // hex (#RRGGBB) or empty
  notes: z.string().optional(),
});
export type Sub = z.infer<typeof Sub>;

/**
 * Materials Expense (= Airtable "Materials Expenses" record). A single vendor
 * invoice that may or may not be assigned to a Job. `projectId` empty = unassigned.
 */
export const MaterialsExpense = z.object({
  id: z.string(),
  name: z.string(),                         // formula on Airtable
  vendor: z.string().optional(),            // singleSelect choice name
  invoiceDate: z.string().optional(),       // YYYY-MM-DD
  invoiceNumber: z.string().optional(),
  po: z.string().optional(),                // PO# — the job's street address
  projectId: z.string().optional(),         // linked Project record ID (empty = unassigned)
  invoiceTotal: z.number().optional(),
  gallons: z.number().optional(),
  totalSupplies: z.number().optional(),
  totalPaint: z.number().optional(),
});
export type MaterialsExpense = z.infer<typeof MaterialsExpense>;

export const Contact = z.object({
  id: z.string(),
  name: z.string(),                         // formula on Airtable
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
});
export type Contact = z.infer<typeof Contact>;
