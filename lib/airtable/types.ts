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
});
export type Job = z.infer<typeof Job>;

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
