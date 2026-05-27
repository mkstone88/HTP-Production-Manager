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
export type UserFieldKey = keyof typeof userFields;
