# HTP Production Manager

Mobile-first PWA for scheduling painting jobs and managing subcontractors,
backed by Airtable as the system of record.

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript
- Tailwind v4 · shadcn/ui-style components
- TanStack Query · FullCalendar (drag & drop)
- Airtable REST API via a small server-side client

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Create your Airtable Personal Access Token

1. Go to <https://airtable.com/create/tokens>
2. Click **Create new token**, give it any name (e.g. `HTP Production Manager`)
3. **Scopes** — add all three:
   - `data.records:read`
   - `data.records:write`
   - `schema.bases:read`
4. **Access** — pick *only* the production-manager base. Don't grant access to other bases.
5. Copy the token. You'll only see it once.

### 3. Find your Base ID

Open your base in the browser. The URL looks like:

```
https://airtable.com/appXXXXXXXXXXXXXX/tblXXXXXXXXXXXXXX/...
                    ^^^^^^^^^^^^^^^^^^
                    this is your Base ID (starts with "app")
```

### 4. Configure environment

```bash
cp .env.example .env.local
```

Then fill in `.env.local`:

- `AIRTABLE_PAT` — the token from step 2
- `AIRTABLE_BASE_ID` — the ID from step 3
- `ADMIN_PASSCODE` — a passcode the team types in to sign in (any string)
- `AUTH_SECRET` — generate with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

### 5. Run

```bash
npm run dev
```

Visit <http://localhost:3000>. You'll be redirected to `/login`. Enter your `ADMIN_PASSCODE`.

## First-run: introspect your Airtable schema

Once you're logged in, open <http://localhost:3000/api/airtable/schema> in your
browser. You'll get a JSON dump of every table in the base, plus every field's
name and type. Save it to `docs/airtable-schema.json` for reference.

Then update `lib/airtable/mapping.ts` so the `tables.*` and `*Fields.*`
constants match your actual Airtable table and column names. The repos
(`lib/airtable/jobs.ts`, `lib/airtable/subs.ts`) read everything through that
mapping — no other file should hardcode field names.

## Project layout

```
app/
  (app)/                       # everything inside requires auth
    layout.tsx                 # nav shell (sidebar on desktop, bottom nav on mobile)
    schedule/                  # calendar + unscheduled sidebar
    jobs/                      # job list (read-only for now)
    subs/                      # subcontractor CRUD
  api/
    airtable/schema/           # GET — schema introspection
    auth/{login,logout}/       # passcode auth
    jobs/                      # GET / POST
    jobs/[id]/                 # GET / PATCH / DELETE
    subs/                      # GET / POST
    subs/[id]/                 # GET / PATCH / DELETE
  login/                       # public login page
  manifest.ts                  # PWA manifest
lib/
  airtable/
    client.ts                  # fetch-based Airtable wrapper (server-only)
    mapping.ts                 # logical name -> Airtable table/field name
    jobs.ts                    # JobsRepo
    subs.ts                    # SubsRepo
    types.ts                   # zod schemas
  auth.ts                      # passcode + signed-cookie session
  env.ts                       # typed env access
  utils.ts                     # cn() helper
components/
  app-shell.tsx                # nav
  query-provider.tsx           # TanStack Query
  calendar/schedule-view.tsx   # FullCalendar + drag-drop logic
  jobs/, subs/                 # list / form
  ui/                          # button, input, label, card (shadcn-style)
middleware.ts                  # auth gate
```

## Roadmap

**v1 (in progress)**

- [x] Project scaffold, auth, PWA shell
- [x] Airtable client + repository abstraction
- [x] Schema introspection endpoint
- [x] Schedule view with drag-and-drop
- [x] Subcontractor CRUD
- [ ] **Confirm Airtable schema** and finalize `lib/airtable/mapping.ts`
- [ ] Job detail / edit page
- [ ] Service worker (network-first for `/api`, SWR for shell)

**v2 — Job costing** (separate plan)

- Manual invoice entry + read auto-imported invoices
- Labor cost entry per job
- Gross profit calculation per job

**Later**

- Subcontractor self-service login (their own schedule view)
- Photo upload from the field
- Offline-first writes (queue mutations in IndexedDB)

## Deploying

Vercel is the easiest target:

1. Push the repo to GitHub.
2. Import on Vercel.
3. Set the four env vars (`AIRTABLE_PAT`, `AIRTABLE_BASE_ID`, `ADMIN_PASSCODE`, `AUTH_SECRET`) in the Vercel project settings.
4. Deploy.

The icons in `public/icons/` are placeholder solid-black squares. Replace with
branded art before a real launch.
