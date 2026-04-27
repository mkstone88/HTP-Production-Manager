/**
 * Maps logical entities (Job, Subcontractor) to actual Airtable table + field names.
 *
 * This file is the single source of truth for "what is the Airtable schema?". After
 * running the schema introspection (GET /api/airtable/schema) and saving the result
 * to docs/airtable-schema.json, fill in the table/field names below to wire up the
 * Jobs and Subs repos.
 *
 * Why this layer exists: it lets the rest of the app refer to fields by stable logical
 * names (e.g. "scheduledStart") even if the Airtable column is named "Start Date" or
 * later renamed. It also keeps the eventual migration off Airtable contained.
 */

export const tables = {
  jobs: "Jobs",                  // TODO: confirm against schema dump
  subs: "Subcontractors",        // TODO: confirm against schema dump
} as const;

export const jobFields = {
  // Required for v1 schedule view.
  name: "Name",                  // TODO: confirm
  client: "Client",              // TODO: confirm
  address: "Address",            // TODO: confirm
  status: "Status",              // TODO: confirm (single-select)
  scheduledStart: "Scheduled Start", // TODO: confirm (date or dateTime)
  scheduledEnd: "Scheduled End",     // TODO: confirm
  assignedSub: "Assigned Sub",       // TODO: confirm (linked record -> Subcontractors)
  notes: "Notes",                    // TODO: confirm

  // Reserved for Phase 6 (job costing) — leave commented until schema confirms.
  // contractAmount: "Contract Amount",
  // laborCost: "Labor Cost",
  // materialCost: "Material Cost",
} as const;

export const subFields = {
  name: "Name",                  // TODO: confirm
  contactName: "Contact",        // TODO: confirm
  phone: "Phone",                // TODO: confirm
  email: "Email",                // TODO: confirm
  trade: "Trade",                // TODO: confirm (or array)
  active: "Active",              // TODO: confirm (checkbox)
  notes: "Notes",                // TODO: confirm
} as const;

export type JobFieldKey = keyof typeof jobFields;
export type SubFieldKey = keyof typeof subFields;
