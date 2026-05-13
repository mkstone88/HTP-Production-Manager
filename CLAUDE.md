# CLAUDE.md

House rules for code changes in this repo. Read this before starting work.
The `README.md` covers running and deploying the app; this file covers how to
*add* to it without breaking patterns.

## What this app is

Mobile-first Next.js PWA that's a thin operational layer over the
**Hometown Operations** Airtable base. React 19 + TanStack Query on the
client; Next.js App Router API routes call Airtable on the server. See
`README.md` for the stack and project layout.

## North star: stay agent-ready

This codebase is being built with an eventual AI-agent feature in mind
("speak to your production manager"). **Do not** add agent infrastructure
yet — but stay disciplined so wiring one in is cheap when the time comes.
That means:

1. **API routes are the only public surface for data.** Anything the UI does
   to read or change state goes through `/api/*`. No direct Airtable calls
   from React components. The same routes will become an agent's tools later
   — build them as if a stranger will call them.

2. **Zod schemas are the contract.** Define request/response shapes in
   `lib/airtable/types.ts` (or beside the route). Validate inputs in API
   routes with them. They double as future agent tool input schemas.

3. **Push logic to the server, not components.** "Find jobs missing colors,"
   "what's overdue this week," "summary by crew" — these belong as named
   endpoints (e.g. `GET /api/jobs/outstanding`), not `.filter()` chains in
   React. Components should be pure presentation + form handling.

4. **Stable vocabulary.** Don't rename status enum values, field keys, or
   logical names casually. Agents (and humans) memorize them. Add new ones;
   don't repurpose old ones.

5. **One file owns Airtable column names: `lib/airtable/mapping.ts`.**
   Everywhere else uses logical names (`scheduledStart`, not
   `"Job Start Date"`). If Airtable renames a column, only this file changes.

## Recipe for a new feature

The default order. Don't skip steps.

1. **Data shape.** If new Airtable fields are needed, add them (or ask the
   user) and register the field in `lib/airtable/mapping.ts`.
2. **Schema.** Extend the entity Zod schema in `lib/airtable/types.ts`.
3. **Repo.** Update `lib/airtable/{jobs,subs,contacts}.ts` — `fromRecord`
   reads, `toFields` writes.
4. **API.** Update `app/api/.../route.ts` — extend request body schemas,
   return the new field. Add new endpoints for cross-cutting reads (e.g.
   "outstanding items on a job") rather than computing them client-side.
5. **UI.** Only now build the React.

Tempted to skip step 4 because "the UI just needs this one calculation"?
Ask: would an agent want to call this? If yes, make it an endpoint.

## Domain map

| Logical | Airtable table | Repo                          |
|---------|----------------|-------------------------------|
| Job     | `Projects`     | `lib/airtable/jobs.ts`        |
| Sub     | `Crews`        | `lib/airtable/subs.ts`        |
| Contact | `Contacts`     | `lib/airtable/contacts.ts`    |

Field names live only in `lib/airtable/mapping.ts`.

## Gotchas

- `Job Name` is an Airtable formula. Can't write to it — set Job Number +
  Customer + Project Type and Airtable computes it.
- `Name (from Customer)` and `Street Address  (from Customer)` are lookups
  on Projects. Read-only. Note the **two spaces** in the address name.
- Airtable date fields are date-only (`YYYY-MM-DD`, no time).
- FullCalendar all-day `end` is **exclusive**; Airtable's is inclusive. See
  `addDays` in `components/calendar/schedule-view.tsx`.
- This dev sandbox doesn't have Airtable secrets. To inspect or modify the
  schema, use the Airtable MCP tools against base `appNPi0v8wFD4Peq0`
  ("Hometown Operations") — don't try to call the Airtable REST API
  directly from a script.
- **Status auto-advance lives in Airtable, not the app.** An Airtable
  automation flips `Status` from `Proposal Accepted` → `Scheduled` when
  `Job Start Date` is set. Don't reimplement this in the app or you'll
  double-fire. Same idea for any other status transitions: prefer Airtable
  automations so they fire regardless of who set the field (app, Zapier,
  direct edit).
- **Project lifecycle.** New `Projects` records flow in automatically from
  the estimating software via Zapier when a proposal is accepted. The
  Zapier automation also populates `Work Order URL`. The app's job is the
  *triage* between accepted and scheduled — see `app/api/jobs/triage/` and
  `components/jobs/jobs-triage.tsx`. Pre-job staging fields:
  `Email Sent`, `Customer Replied`, `Colors Received`, `Work Order Ready`
  (all checkboxes), plus derived `crewAssigned` (from `Crew Leader`) and
  `scheduled` (from `Job Start Date`). Add new staging steps in
  `lib/jobs/staging.ts` AND update the `StagingStep` enum in
  `lib/airtable/types.ts`.

## Verify before committing

- `npm run lint` — files you touched should be clean. There are pre-existing
  errors in `components/jobs/job-detail.tsx` and `job-quick-edit.tsx` from
  React 19's `react-hooks/set-state-in-effect` rule. Don't fix as a
  drive-by; they need a real refactor (background refetch races vs. local
  edits).
- `npx tsc --noEmit` — typecheck.
- `npm run dev` — start the local server when you need to actually exercise
  a UI change in the browser.

## What not to do

- Don't add an LLM/agent abstraction layer "just in case." YAGNI until the
  feature is on the table.
- Don't denormalize data for hypothetical agent consumption. Current shape
  is fine.
- Don't bypass the API layer with a Server Action that talks to Airtable
  directly. If you need a Server Action, have it call the API route.
