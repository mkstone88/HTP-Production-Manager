import { z } from "zod";

import { ROLES } from "@/lib/roles";

/**
 * Airtable Status singleSelect on Projects.
 * Source of truth: the choices in the Hometown Operations base.
 */
export const JobStatus = z.enum([
  "Proposal Accepted",
  "Scheduled",
  "In Progress",
  "On Hold",
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
  customerEmail: z.string().optional(),     // looked up via the customer link
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

/**
 * App access role. Vocabulary lives in lib/roles.ts (shared with middleware).
 * A user may hold several — Admin is a superset that can reach everything and
 * manage users.
 */
export const Role = z.enum(ROLES);
export type Role = z.infer<typeof Role>;

/**
 * A login account (Airtable "App Users"). Never carries the password hash —
 * that stays server-side in the repo layer.
 */
export const AppUser = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  roles: z.array(Role),
  active: z.boolean(),
});
export type AppUser = z.infer<typeof AppUser>;

/** The identity carried inside the signed session cookie. */
export type SessionUser = { uid: string; roles: Role[] };

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

/* Sales / appointment-setting side                                           */
/* -------------------------------------------------------------------------- */

/**
 * Controlled vocabularies for the Opportunity single-selects. These mirror the
 * Airtable choices and are the stable vocabulary for UI selects and filters.
 *
 * NOTE: reads (`fromRecord`) do NOT hard-validate against these — Airtable is
 * the source of truth and may grow choices, so the raw Opportunity fields are
 * typed as plain strings. Use these enums to build pickers, not to gate reads.
 */
export const SaleOutcome = z.enum(["Won", "Lost", "Pending"]);
export type SaleOutcome = z.infer<typeof SaleOutcome>;

export const SetterStatus = z.enum([
  "Open",
  "Reschedule Needed",
  "Booked",
  "Disqualified",
  "Lost",
  "Abandoned",
]);
export type SetterStatus = z.infer<typeof SetterStatus>;

export const LeadSource = z.enum([
  "Google LSA",
  "Google PPC",
  "Website / Organic",
  "Facebook",
  "Referral",
  "Repeat Customer",
  "BNI",
  "B2B",
  "Job Site",
  "AI / LLM",
  "Other",
]);
export type LeadSource = z.infer<typeof LeadSource>;

export const OppJobType = z.enum([
  "Interior",
  "Exterior",
  "Cabinets",
  "Staining",
  "Other",
]);
export type OppJobType = z.infer<typeof OppJobType>;

/** Exactly the choices on the Airtable "Disqualify Reason" single-select. */
export const DisqualifyReason = z.enum([
  "Outside Service Area",
  "Project Too Small",
  "Price-Only Shopper",
  "Timing",
  "Wrong Service Type",
]);
export type DisqualifyReason = z.infer<typeof DisqualifyReason>;

/**
 * The three terminal outcomes a setter can assign a lead. Open / Reschedule
 * Needed are working states; Lost / Junk are legacy Setter Status values kept
 * out of the setter workflow.
 */
export const LeadOutcome = z.enum(["Booked", "Disqualified", "Abandoned"]);
export type LeadOutcome = z.infer<typeof LeadOutcome>;

/** Working (non-terminal) setter statuses — the leads that still need work. */
export const LEAD_WORKING_STATUSES = ["Open", "Reschedule Needed"] as const;

/**
 * Opportunity (= Airtable "NEW - Opportunities" record), flattened for the app.
 * Select-like fields are plain strings on purpose (Airtable is source of truth);
 * the vocab enums above are for building UI, not validating reads.
 */
export const Opportunity = z.object({
  id: z.string(),
  name: z.string(),
  contactId: z.string().optional(),         // Airtable record ID of NEW - Contacts
  emailFromContact: z.string().optional(),  // lookup from the linked contact
  source: z.string().optional(),
  rawSource: z.string().optional(),
  captureMethod: z.string().optional(),
  jobType: z.string().optional(),
  leadType: z.string().optional(),
  setterStatus: z.string().optional(),
  disqualifyReason: z.string().optional(),
  appointmentStatus: z.string().optional(),
  leadCreatedAt: z.string().optional(),     // ISO datetime
  firstContactedAt: z.string().optional(),
  lastContactedAt: z.string().optional(),
  bookedAt: z.string().optional(),
  disqualifiedAt: z.string().optional(),
  abandonedAt: z.string().optional(),
  appointmentAt: z.string().optional(),
  nextFollowUpDate: z.string().optional(),
  contactAttempts: z.number().optional(),
  phone: z.string().optional(),             // "Phone (from Contact)" lookup
  proposalSent: z.boolean().optional(),
  proposalSentDate: z.string().optional(),  // YYYY-MM-DD
  proposalAmount: z.number().optional(),
  wonAmount: z.number().optional(),
  saleOutcome: z.string().optional(),
  reasonLost: z.string().optional(),
  dateOfSale: z.string().optional(),        // YYYY-MM-DD
  estimator: z.string().optional(),
  matchEmail: z.string().optional(),
  ghlContactId: z.string().optional(),
  ghlOpportunityId: z.string().optional(),
  paintScoutQuoteId: z.string().optional(),
  notes: z.string().optional(),
  createdTime: z.string().optional(),       // Airtable record createdTime (fallback anchor)
});
export type Opportunity = z.infer<typeof Opportunity>;

/**
 * One decided proposal, flattened for the sales dashboard. Response contract for
 * `GET /api/analytics/sales`. Win rate = won ÷ all of these; a Pending proposal
 * counts as effectively lost until it converts (see lib/analytics/sales.ts).
 */
export const SalesRow = z.object({
  id: z.string(),
  name: z.string(),
  won: z.boolean(),
  pending: z.boolean(),
  jobType: z.string(),
  source: z.string(),
  amount: z.number(),
  city: z.string(),
  period: z.string(),                       // YYYY-MM (lead-created attribution month)
  date: z.string(),                         // YYYY-MM-DD — lead created
  sentDate: z.string(),                     // YYYY-MM-DD — proposal sent ("" if none)
  acceptedDate: z.string(),                 // YYYY-MM-DD — proposal accepted / date of sale ("" if not won)
});
export type SalesRow = z.infer<typeof SalesRow>;

/**
 * One opportunity reduced to funnel stages, for the source × month view.
 * Stages nest (a won job counts as having had a proposal and an appointment) so
 * the funnel stays monotonic. Response contract for GET /api/analytics/funnel.
 */
export const FunnelRow = z.object({
  source: z.string(),
  // Each stage carries the month it happened (YYYY-MM, "" if it didn't), so the
  // client can bucket by lead cohort (leadMonth) OR by activity (each stage in
  // its own event month — e.g. proposals in the month they were sent).
  leadMonth: z.string(),                    // Lead Created At
  apptMonth: z.string(),                    // appointment / booked
  proposalMonth: z.string(),                // proposal sent
  wonMonth: z.string(),                     // date of sale
  revenue: z.number(),
  appt: z.boolean(),
  proposal: z.boolean(),
  won: z.boolean(),
});
export type FunnelRow = z.infer<typeof FunnelRow>;

/**
 * A templated customer email, editable under Admin → Settings. Template types
 * are data (one Airtable row each), so new ones can be added without code.
 * Contract for /api/templates.
 */
export const EmailTemplate = z.object({
  id: z.string(),
  name: z.string(),                         // shown in dropdowns; matched to Project Type
  subject: z.string(),
  body: z.string(),
});
export type EmailTemplate = z.infer<typeof EmailTemplate>;

export const EmailTemplateInput = z.object({
  name: z.string().min(1).max(100),
  subject: z.string().max(300).default(""),
  body: z.string().max(20000).default(""),
});
export type EmailTemplateInput = z.infer<typeof EmailTemplateInput>;

/**
 * One open (pending) proposal on the sales Deals board. Response contract for
 * GET /api/sales/deals. `waiting` = a future follow-up is scheduled, so the
 * deal rests in the lower section until that time arrives.
 */
export const DealRow = z.object({
  id: z.string(),
  name: z.string(),                         // contact name (falls back to opportunity)
  amount: z.number(),                       // proposal amount sent
  sentDate: z.string(),                     // YYYY-MM-DD proposal sent ("" if unknown)
  daysOut: z.number().nullable(),           // days since the proposal was sent
  estimator: z.string(),
  source: z.string(),
  jobType: z.string(),
  followUpAt: z.string().optional(),        // salesman's next check-in (ISO)
  waiting: z.boolean(),                     // followUpAt is in the future
  notes: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  ghlUrl: z.string().optional(),            // deep link to the contact in GoHighLevel
});
export type DealRow = z.infer<typeof DealRow>;

/** A lead whose Source needs assigning/correcting. GET /api/sources/review + search. */
export const SourceReviewRow = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().optional(),
  rawSource: z.string().optional(),
  source: z.string().optional(),
  createdAt: z.string().optional(),
});
export type SourceReviewRow = z.infer<typeof SourceReviewRow>;

/** Optional per-week goals (from a "NEW - Weekly Goals" table, if it exists). */
export const WeekGoals = z
  .object({
    leads: z.number(),
    appts: z.number(),
    jobsSold: z.number(),
    dollarsSold: z.number(),
    invoiced: z.number(),
  })
  .partial();
export type WeekGoals = z.infer<typeof WeekGoals>;

/**
 * One week of the scorecard, week-of-activity accounting (Mon–Sun, Central).
 * Response contract for `GET /api/scorecard`.
 */
export const WeekRow = z.object({
  weekStart: z.string(),                    // YYYY-MM-DD (Monday)
  label: z.string(),                        // e.g. "Jun 30 – Jul 6"
  leads: z.number(),
  appts: z.number(),
  jobsSold: z.number(),
  dollarsSold: z.number(),
  invoiced: z.number(),
  collected: z.number(),
  goals: WeekGoals.optional(),
});
export type WeekRow = z.infer<typeof WeekRow>;

/**
 * A lead as the setter queue sees it — an Opportunity flattened with the
 * contact's name/phone and derived cadence flags. Response contract for
 * GET /api/leads/queue and /recent.
 */
export const Lead = z.object({
  id: z.string(),
  name: z.string(),                         // contact full name (falls back to opportunity)
  email: z.string().optional(),
  phone: z.string().optional(),
  source: z.string().optional(),
  jobType: z.string().optional(),
  status: z.string().optional(),            // Setter Status
  disqualifyReason: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string().optional(),         // Lead Created At
  firstContactedAt: z.string().optional(),
  lastContactedAt: z.string().optional(),
  appointmentAt: z.string().optional(),
  bookedAt: z.string().optional(),
  nextFollowUpDate: z.string().optional(),
  callbackAt: z.string().optional(),        // customer-requested callback; overrides cadence
  contactAttempts: z.number(),
  ageDays: z.number().nullable(),
  overdue: z.boolean(),                     // needs attention now (state ≠ waiting)
  // Queue position + chip: new (never touched — call NOW) → callback (requested
  // time has arrived) → decision (cadence exhausted) → due → waiting.
  queueState: z.enum(["new", "callback", "decision", "due", "waiting"]),
  ghlContactId: z.string().optional(),      // GHL Contact ID (correlation key)
  ghlUrl: z.string().optional(),            // deep link to the contact in GoHighLevel
});
export type Lead = z.infer<typeof Lead>;

/* -------------------------------------------------------------------------- */
/* Reconciliation sweeps (read-only safety net)                               */
/* -------------------------------------------------------------------------- */

/** A GHL lead that has no matching Airtable opportunity. */
export const ReconcileGap = z.object({
  ghlId: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  source: z.string(),
  status: z.string(),
  createdAt: z.string(),
  reason: z.enum(["not-in-airtable", "no-email-to-match"]),
});
export type ReconcileGap = z.infer<typeof ReconcileGap>;

export const ReconcileResult = z.object({
  ranAt: z.string(),
  windowDays: z.number(),
  ghlChecked: z.number(),
  matched: z.number(),
  gaps: z.array(ReconcileGap),
});
export type ReconcileResult = z.infer<typeof ReconcileResult>;

/** A PaintScout quote that's missing from Airtable or whose outcome disagrees. */
export const ProposalIssue = z.object({
  kind: z.enum(["missing", "outcome-mismatch"]),
  quoteNumber: z.number(),
  name: z.string(),
  email: z.string(),
  psStatus: z.string(),
  airtableOutcome: z.string().nullable(),
  total: z.number(),
  sentDate: z.string().nullable(),
  detail: z.string(),
});
export type ProposalIssue = z.infer<typeof ProposalIssue>;

export const ProposalReport = z.object({
  ranAt: z.string(),
  quotesChecked: z.number(),
  matched: z.number(),
  issues: z.array(ProposalIssue),
});
export type ProposalReport = z.infer<typeof ProposalReport>;

/** Records that collide on a shared GHL id (data-integrity check). */
export const DupRow = z.object({
  id: z.string(),
  label: z.string(),
  extra: z.string(),
});
export type DupRow = z.infer<typeof DupRow>;

export const DupGroup = z.object({
  ghlId: z.string(),
  rows: z.array(DupRow),
});
export type DupGroup = z.infer<typeof DupGroup>;

export const DuplicateReport = z.object({
  ranAt: z.string(),
  opportunities: z.array(DupGroup),
  contacts: z.array(DupGroup),
});
export type DuplicateReport = z.infer<typeof DuplicateReport>;

/* -------------------------------------------------------------------------- */
