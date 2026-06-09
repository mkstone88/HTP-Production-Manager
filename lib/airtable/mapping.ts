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
  status: "Status",                              // singleSelect: Proposal Accepted | Scheduled | In Progress | Completed
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
  role: "Role",                  // singleSelect: admin | user
  password: "Password",          // singleLineText — PBKDF2 hash string
  active: "Active",              // checkbox — disable login without deleting
} as const;

export type JobFieldKey = keyof typeof jobFields;
export type SubFieldKey = keyof typeof subFields;
export type ContactFieldKey = keyof typeof contactFields;
export type MaterialsExpenseFieldKey = keyof typeof materialsExpenseFields;
export type UserFieldKey = keyof typeof userFields;
