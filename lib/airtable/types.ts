import { z } from "zod";

export const JobStatus = z.enum([
  "Lead",
  "Estimating",
  "Booked",
  "In Progress",
  "Punch List",
  "Complete",
  "Lost",
]);
export type JobStatus = z.infer<typeof JobStatus>;

export const Job = z.object({
  id: z.string(),
  name: z.string(),
  client: z.string().optional(),
  address: z.string().optional(),
  status: z.string().optional(),
  scheduledStart: z.string().datetime().optional().or(z.string().optional()),
  scheduledEnd: z.string().datetime().optional().or(z.string().optional()),
  assignedSubId: z.string().optional(), // Airtable record ID of linked sub
  notes: z.string().optional(),
});
export type Job = z.infer<typeof Job>;

export const Sub = z.object({
  id: z.string(),
  name: z.string(),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  trade: z.string().optional(),
  active: z.boolean().optional(),
  notes: z.string().optional(),
});
export type Sub = z.infer<typeof Sub>;
