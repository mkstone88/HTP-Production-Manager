# HTP Production Manager

Mobile-first PWA for scheduling painting jobs and managing subcontractors,
backed by the existing **Hometown Operations** Airtable base.

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript
- Tailwind v4 · shadcn/ui-style components
- TanStack Query · FullCalendar (drag & drop)
- Airtable REST API via a small server-side client

## Airtable schema this app expects

The app maps logical names → Airtable columns in [lib/airtable/mapping.ts](lib/airtable/mapping.ts).
The Hometown Operations base is the source of truth — adjust the mapping if
columns are renamed.

| Logical entity | Airtable table |
|----------------|----------------|
| Job            | `Projects`     |
| Subcontractor  | `Crews`        |
| Contact        | `Contacts`     |

Notes:

- `Job Name` is a formula (`{Job Number}-{Customer} {Project Type}`). The app
  cannot write to it; it is computed when you set the inputs.
- `Street Address (from Customer)` and `Name (from Customer)` are lookups —
  read-only on the Project. Edit the Contact directly to change them.
- `Crews.Status` is a 5-state singleSelect (Active / Onboarding / Inactive /
  Prospect / Do Not Use!), exposed as a dropdown in the sub form.

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Create your Airtable Personal Access Token

1. <https://airtable.com/create/tokens> → **Create new token**
2. **Scopes:**
   - `data.records:read`
   - `data.records:write`
   - `schema.bases:read`
3. **Access:** select only the **Hometown Operations** base.

### 3. Configure environment

```bash
cp .env.example .env.local
```

Fill in:

- `AIRTABLE_PAT` — token from step 2
- `AIRTABLE_BASE_ID` — `appNPi0v8wFD4Peq0` (Hometown Operations)
- `ADMIN_PASSCODE` — shared passcode for the team
- `AUTH_SECRET` — random 32+ char string. Generate with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

### 4. Run

```bash
npm run dev
```

Visit <http://localhost:3000> → redirected to `/login`. Enter your passcode.

## Schedule view

- Drag a card from the **Unscheduled** drawer onto a calendar day to schedule.
- Drag an existing event to move it; resize the right edge to extend the end date.
- All events are all-day (matches Airtable's date-only fields).
- **Show completed** toggle: when on, completed jobs appear grayed out and
  hatched. Turn it off to hide them entirely.
- Filter by sub via the dropdown.

On mobile the unscheduled list is a bottom drawer — tap the handle to expand.

## Creating a job

`/jobs/new` — pick (or create) a customer, set Job Number + Project Type, and
optional schedule/crew. The customer picker:

- Searches existing Contacts by name/phone/email.
- Has a **Create new contact** action when the customer isn't in Airtable yet.
  The new contact is created on submit, then linked to the new Project in one
  request.

## Project layout

```
app/
  (app)/                       # everything inside requires auth
    layout.tsx                 # nav shell (sidebar on desktop, bottom nav on mobile)
    schedule/                  # calendar + unscheduled drawer
    jobs/                      # list + create + detail/edit
    subs/                      # subcontractor CRUD
  api/
    airtable/schema/           # GET — schema introspection
    auth/{login,logout}/       # passcode auth
    contacts/                  # GET (search) / POST (create)
    jobs/                      # GET / POST (POST accepts customerId OR newContact)
    jobs/[id]/                 # GET / PATCH / DELETE
    subs/                      # GET / POST
    subs/[id]/                 # GET / PATCH / DELETE
  login/                       # public login page
  manifest.ts                  # PWA manifest
lib/
  airtable/
    client.ts                  # fetch-based Airtable wrapper (server-only)
    mapping.ts                 # logical name -> Airtable table/field name
    types.ts                   # zod schemas (status enums, etc.)
    jobs.ts                    # JobsRepo (Projects table)
    subs.ts                    # SubsRepo (Crews table)
    contacts.ts                # ContactsRepo (read + create)
    errors.ts                  # shared error → JSON response helper
  auth.ts                      # passcode + signed-cookie session
  env.ts                       # typed env access
  utils.ts                     # cn() helper
components/
  app-shell.tsx                # nav
  query-provider.tsx           # TanStack Query
  calendar/schedule-view.tsx   # FullCalendar + drag-drop logic
  jobs/{jobs-list,job-form,job-detail,customer-picker}.tsx
  subs/{subs-list,sub-form,sub-detail}.tsx
  ui/                          # button, input, label, card (shadcn-style)
proxy.ts                       # auth gate (Next 16 convention)
```

## Roadmap

**v1**

- [x] Project scaffold, auth, PWA shell
- [x] Airtable client + repository abstraction
- [x] Schema introspection endpoint
- [x] Schedule view with drag-and-drop (all-day events)
- [x] Subcontractor CRUD
- [x] Aligned mapping with Hometown Operations schema
- [x] Job create flow with inline contact creation
- [x] Job detail / edit page
- [ ] Service worker (network-first for `/api`, SWR for shell)

**v2 — Job costing**

The Projects table already has Sub Payout, Material Charges, Gross Profit, GP %,
etc. — surface these in the job detail view.

**Later**

- Subcontractor self-service login (their own schedule view)
- Photo upload from the field
- Offline-first writes (queue mutations in IndexedDB)

## Deploying

Vercel:

1. Push the repo to GitHub.
2. Import on Vercel.
3. Set the four env vars (`AIRTABLE_PAT`, `AIRTABLE_BASE_ID`, `ADMIN_PASSCODE`, `AUTH_SECRET`).
4. Deploy.

Replace the placeholder icons in `public/icons/` with branded art before launch.
