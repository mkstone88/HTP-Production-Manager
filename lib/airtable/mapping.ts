/**
 * Maps logical entities (Job, Subcontractor, Contact) to actual Airtable table + field
 * names in the "Hometown Operations" base.
 *
 * The rest of the app refers to fields by stable logical names (e.g. "scheduledStart")
 * regardless of what the Airtable column is actually called. This is the only place
 * Airtable names live.
 */

export const tables = {
  jobs: "Projects",
  subs: "Crews",
  contacts: "Contacts",
  materialsExpenses: "Materials Expenses",
  users: "App Users",
  // Sales / appointment-setting side (parallel-build "NEW - " tables).
  opportunities: "NEW - Opportunities",
  opportunityContacts: "NEW - Contacts",
  sourceMapping: "NEW - Source Mapping",
  weeklyGoals: "NEW - Weekly Goals",
  emailTemplates: "Email Templates",
} as const;

/**
 * Job (= Airtable "Projects" record).
 *
 * Notes:
 *  - `name` is a formula on Airtable (Job Number-Customer Project Type). It cannot be
 *    written. To create a Project we set jobNumber + customer + projectType and the
 *    name auto-computes.
 *  - `customerName` and `address` are lookups from the linked Customer record. Read-only.
 *  - `customer` is a linked record to Contacts. Stored/written as an array of record IDs.
 *  - `scheduledStart` / `scheduledEnd` are date-only fields (YYYY-MM-DD).
 */
export const jobFields = {
  name: "Job Name",                              // formula (read-only)
  jobNumber: "Job Number",                       // singleLineText (writable)
  customer: "Customer",                          // linked record -> Contacts
  customerName: "Name (from Customer)",          // lookup (read-only)
  address: "Street Address  (from Customer)",    // lookup (read-only) — note: two spaces in name
  customerEmail: "Email (from Customer)",        // lookup (read-only) — for the triage email button
  status: "Status",                              // singleSelect: Proposal Accepted | Scheduled | In Progress | Completed | On Hold
  projectType: "Project Type",                   // singleSelect
  scheduledStart: "Job Start Date",              // date (no time)
  scheduledEnd: "Job Complete Date",             // date (no time)
  assignedSub: "Crew Leader",                    // linked record -> Crews
  notes: "Notes",                                // multilineText
  // Pre-job staging checkboxes (Triage tab):
  emailSent: "Email Sent",                       // checkbox — project email sent to customer
  customerReplied: "Customer Replied",           // checkbox — customer acknowledged the email
  colorsReceived: "Colors Received",             // checkbox — customer provided colors
  workOrderUrl: "Work Order URL",                // url — populated by Zapier when proposal accepted
  workOrderReady: "Work Order Ready",            // checkbox — work order has been polished/edited
  // Job-costing fields. Only projectAmount, subPayout and jobCostingComplete are
  // writable; the rest are Airtable formulas/rollups recomputed automatically.
  projectAmount: "Project Amount",               // currency (writable) — what the customer paid; adjust for change orders
  subPayout: "Sub Payout",                       // currency (writable) — crew pay, entered when costing the job
  jobCostingComplete: "Job Costing Complete",    // checkbox (writable) — costing finalized; hides job from the worklist
  totalMaterialsExpense: "Total Materials Expense", // rollup (read-only) — sum of assigned invoice totals
  grossProfit: "Gross Profit",                   // formula (read-only)
  grossProfitPct: "GP %",                        // formula (read-only) — same Total Cogs basis as Gross Profit above; duplicate "Gross Profit %" exists but uses a different COGS basis
  totalCogs: "Total Cogs",                       // formula (read-only)
  laborOverage: "Labor Overage",                 // formula (read-only)
  materialsOverage: "Materials Overage",         // formula (read-only)
} as const;

/**
 * Subcontractor (= Airtable "Crews" record).
 *
 *  - `name` = Company Name (singleLineText, primary, writable)
 *  - `status` is the full singleSelect, exposed directly (Active / Onboarding / Inactive /
 *    Prospect / Do Not Use!) — no boolean abstraction.
 */
export const subFields = {
  name: "Company Name",
  contactName: "Contact Name",
  phone: "Phone",
  email: "Email",
  status: "Status",
  color: "Color",                // singleLineText, hex like #RRGGBB (optional)
  notes: "Notes",
} as const;

/**
 * Contact (= Airtable "Contacts" record). Read-only from the app's perspective except
 * for create — we don't edit existing contacts here.
 */
export const contactFields = {
  name: "Name",                  // formula: First & " " & Last (read-only)
  firstName: "First Name",
  lastName: "Last Name",
  email: "Email",
  phone: "Phone Number",
  street: "Street Address ",     // note: trailing space
  city: "City",
  state: "State",
  zip: "Zip Code",
} as const;

/**
 * Materials Expense (= Airtable "Materials Expenses" record). One row per vendor
 * invoice. New rows arrive automatically from an email-parsing automation that
 * fills everything except `project` — assigning the invoice to a job is the one
 * step done by hand (and in this app).
 *
 *  - `project` is a linked record to Projects. Empty array = unassigned.
 *  - `po` (PO#) holds the job's street address; we use it to match invoices to jobs.
 */
export const materialsExpenseFields = {
  name: "Name",                  // formula (read-only)
  vendor: "Vendor",              // singleSelect
  invoiceDate: "Invoice Date",   // date (no time)
  invoiceNumber: "Invoice Number",
  po: "PO#",                     // singleLineText — we use the job address as the PO
  project: "Project",            // linked record -> Projects (empty = unassigned)
  invoiceTotal: "Invoice Total", // currency
  gallons: "Number of Gallons",  // number
  totalSupplies: "Total Supplies", // currency
  totalPaint: "Total Paint",     // currency
} as const;

/**
 * App login account (= Airtable "App Users" record). This is the app's own
 * auth table, separate from the business "People" table. `password` stores a
 * salted PBKDF2-SHA256 hash (see lib/auth.ts) — never a plaintext password.
 */
export const userFields = {
  name: "Name",                  // singleLineText (primary)
  email: "Email",                // email — login identifier
  roles: "Roles",                // multipleSelects: Admin | Office Admin | Production Manager | Sales | Subcontractor
  legacyRole: "Role",            // singleSelect (legacy admin/user) — read-only fallback during migration
  password: "Password",          // singleLineText — PBKDF2 hash string
  active: "Active",              // checkbox — disable login without deleting
} as const;

// --- Sales / appointment-setting side ---------------------------------------
// See lib/airtable/{opportunities,leads,sources}.ts for how these are consumed.
export const opportunityFields = {
  name: "Opportunity",                         // singleLineText (primary)
  contact: "Contact",                          // linked record -> NEW - Contacts
  emailFromContact: "Email (from Contact)",    // lookup (read-only) — for reconcile matching
  phoneFromContact: "Phone (from Contact)",    // lookup (read-only) — for the setter queue
  source: "Source",                            // singleSelect (canonical)
  rawSource: "Raw Source",                     // singleLineText (pre-normalization)
  captureMethod: "Capture Method",             // singleSelect
  jobType: "Job Type",                         // singleSelect
  leadType: "Lead Type",                       // singleSelect
  setterStatus: "Setter Status",               // singleSelect
  disqualifyReason: "Disqualify Reason",       // singleSelect
  appointmentStatus: "Appointment Status",     // singleSelect
  leadCreatedAt: "Lead Created At",            // dateTime — attribution anchor
  firstContactedAt: "First Contacted At",      // dateTime
  lastContactedAt: "Last Contacted At",        // dateTime
  bookedAt: "Booked At",                       // dateTime
  disqualifiedAt: "Disqualified At",           // dateTime
  lostAt: "Lost At",                           // dateTime
  abandonedAt: "Abandoned At",                 // dateTime
  appointmentAt: "Appointment Date/Time",      // dateTime
  nextFollowUpDate: "Next Follow-Up Date",     // dateTime — setter cadence
  callbackAt: "Callback At",                   // dateTime — customer-requested callback; overrides cadence
  salesFollowUpAt: "Sales Follow-Up At",       // dateTime — salesman's next check-in on a pending proposal
  contactAttempts: "# Contact Attempts",       // number
  lastAction: "Last Action",                   // singleLineText (audit)
  lastActionBy: "Last Action By",              // singleLineText (audit — user email)
  lastActionAt: "Last Action At",              // dateTime (audit)
  proposalSent: "Proposal Sent",               // checkbox
  proposalSentDate: "Proposal Sent Date",      // date
  proposalAmount: "Proposal Amount (Sent)",    // currency
  wonAmount: "Won Amount (Accepted)",          // currency
  saleOutcome: "Sale Outcome",                 // singleSelect: Won | Lost | Pending
  reasonLost: "Reason Lost",                   // singleLineText
  dateOfSale: "Date of Sale",                  // date
  estimator: "Estimator",                      // singleLineText
  matchEmail: "Match Email",                   // singleLineText (correlation key)
  ghlContactId: "GHL Contact ID",              // singleLineText (correlation key)
  ghlOpportunityId: "GHL Opportunity ID",      // singleLineText (correlation key)
  paintScoutQuoteId: "Paint Scout Quote ID",   // singleLineText (correlation key)
  notes: "Notes",                              // multilineText
} as const;

export const opportunityContactFields = {
  name: "Full Name",                           // singleLineText (primary)
  firstName: "First Name",
  lastName: "Last Name",
  email: "Email",
  phone: "Phone",
  street: "Street Address",
  city: "City",
  state: "State",
  zip: "Zip",
  ghlContactId: "GHL Contact ID",
  notes: "Notes",
  opportunities: "NEW - Opportunities",        // reverse link -> the contact's opportunities
} as const;

export const sourceMappingFields = {
  rawValue: "Raw Value",
  canonicalSource: "Canonical Source",
  notes: "Notes",
} as const;

/**
 * Email template (= Airtable "Email Templates" record). Fully data-driven:
 * adding a row adds a template type to the app — no code change needed. The
 * triage "Send email" dialog matches Template Name against the job's Project
 * Type to pre-select one.
 */
export const emailTemplateFields = {
  name: "Template Name",
  subject: "Subject",
  body: "Body",
} as const;

export const weeklyGoalFields = {
  weekStart: "Week Start",                     // date (Monday of the week)
  leads: "Leads Goal",
  appts: "Appointments Goal",
  jobsSold: "Jobs Sold Goal",
  dollarsSold: "Dollars Sold Goal",
  invoiced: "Invoiced Goal",
} as const;

export type JobFieldKey = keyof typeof jobFields;
export type SubFieldKey = keyof typeof subFields;
export type ContactFieldKey = keyof typeof contactFields;
export type MaterialsExpenseFieldKey = keyof typeof materialsExpenseFields;
export type UserFieldKey = keyof typeof userFields;
export type OpportunityFieldKey = keyof typeof opportunityFields;
