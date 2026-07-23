# Codebase Review — 2026-07-23

Full-codebase review after the first weeks of real-world use. Three dimensions:
security, data-integrity/functionality, and UI/UX for field use. Items are
ranked; strike through / date items as they land.

**TL;DR:** Foundation is strong — no critical vulnerabilities, no
happy-path data corruption. Top three: (1) API routes don't enforce roles
(any logged-in user can delete jobs or read financials via direct API calls);
(2) two data-loss bugs in job editing (full-object PATCH, refetch-clobbers-
typing race); (3) failed saves in the field roll back silently.

## What's in good shape

- **Auth crypto is solid.** HMAC-signed httpOnly cookies with timing-safe
  comparison, PBKDF2 salted self-describing hashes, uniform login errors,
  proper logout, last-admin/self-delete guardrails. No secrets in the client
  bundle; no XSS sinks found.
- **No mass-assignment.** Every write goes through an explicit `toFields()`
  allowlist; PATCH routes enumerate patchable keys. Zod validation is
  near-universal.
- **House rules are followed.** Zero Airtable field names outside
  `mapping.ts`, no legacy-table reads, no direct Airtable calls from
  components, GHL communication rule respected, FullCalendar exclusive-end
  handled correctly both directions.
- **Hardest UX patterns done right where they exist**: optimistic updates
  with snapshot/rollback (schedule drag, triage checkboxes, crew assign),
  iOS 16px-input zoom prevention, safe-area padding, bottom-sheet modals.

Most gaps are the newer suites (costing, leads, marketing, reconcile,
analytics) outpacing the discipline of the original core.

## 1. Security

- **S1 (High) — FIXED 2026-07-23: API routes didn't mirror page-level role
  restrictions.** Now guarded: cheap cookie-role check (`requireSessionRole`)
  on GETs, fresh `requireRole` on mutations.
  `proxy.ts` says "Data APIs stay session-only (routes self-check)" — but
  the production-side routes never self-check. No role guard on:
  `jobs` (incl. DELETE `jobs/[id]`), `jobs/triage`, `subs`, `materials`,
  `costing/dashboard`, `contacts` (customer PII), `analytics/sales`,
  `scorecard`. Any authenticated session — including Subcontractor — can
  delete jobs or read financials. Fix: `requireRole(...)` matching each
  page's `ROUTE_ACCESS` rule, like `analytics/funnel` already does.
- **S2 (Medium) — FIXED 2026-07-23:** `/api/airtable/schema` dumped the
  entire base schema to any logged-in user. Now `requireAdmin()`.
- **S3 (Medium): Deactivation doesn't lock users out for up to 30 days.**
  `sessionHasRole`-guarded routes trust cookie roles and never re-check
  Airtable. Fix: use `requireRole` (fresh read) or add token versioning.
- **S4 (Medium): No login rate limiting**, and unknown emails return faster
  than wrong passwords (PBKDF2 skipped → timing-based email enumeration).
  Add throttling + dummy hash verification on the not-found path.
- **S5 (Medium):** `GET /api/reconcile/backfill` is a state-changing GET,
  CSRF-reachable under `sameSite=lax`. Make write reconcile endpoints POST.
- **S6 (Low):** ~~No security headers~~ (FIXED 2026-07-23 — frame-ancestors
  CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy in
  `next.config.ts`; full script-src CSP still open). PBKDF2 at 100k iterations
  vs OWASP 600k (self-describing format makes raising safe). PaintScout
  error path leaks a key fingerprint to clients (`lib/paintscout.ts`).

## 2. Data-loss bugs

- **B1 (High):** `job-detail.tsx` PATCHes every field, not just changed
  ones. Editing notes with a stale page overwrites a concurrent reschedule.
  Diff against fetched job; send only dirty keys (API already supports it).
- **B2 (High):** The `set-state-in-effect` lint errors are a real
  typing-loss bug: quick-edit's debounced save → invalidate → refetch
  re-seeds local state, discarding characters typed during the round-trip.
  Fix with B1: seed once per job id, don't reset dirty fields.
- **B3 (High UX): Silent rollbacks.** `jobs-list.tsx` (crew assign) and
  `jobs-triage.tsx` (staging checkboxes) restore cache on error with no
  message; `schedule-view.tsx` does it right. Add a shared toast. Related:
  login form has no catch on network failure; survey autosave badge claims
  "retrying" but never retries.
- **B4 (Medium): Formula escaping wrong in five places** (`leads.ts`,
  `sources.ts`, `opportunity-contacts.ts`, `source-mapping.ts`,
  `marketing-spend.ts`): only `'` escaped, not `\`. Trailing `\` → 422;
  `\'` can inject formula terms. `users.ts` has the correct pattern —
  extract one shared helper.
- **B5 (Medium): No 429 handling/throttling in `lib/airtable/client.ts`.**
  Sequential write loops (source remember, reconcile relinks, backfill) can
  trip Airtable's 5 req/s limit mid-loop → partial state. Add
  Retry-After-honoring retry + token bucket; batch endpoints for loops.
- **B6 (Low): Timezone drift.** Triage "today" is UTC (off-by-one after
  ~7pm Central); sales/marketing analytics bucket months by UTC while the
  scorecard uses Central. Shared `centralToday()`/`centralMonth()` helpers.
- **B7 (Low):** PaintScout failures render as $0 on the scorecard
  (`.catch(() => [])`). Return `paintScoutOk` flag and badge the columns.

## 3. UI/UX for field use

- **U1:** Schedule's mobile drawer (z-20) is buried under the bottom nav
  (z-30) for multi-role users. Offset drawer by nav height.
- **U2:** Pinch-zoom disabled (`userScalable: false` in `app/layout.tsx`).
  The 16px-input trick already prevents iOS focus-zoom; drop it.
- **U3:** Backgrounded PWA shows stale data on reopen
  (`refetchOnWindowFocus: false`). Re-enable — visibilitychange fires on
  PWA resume.
- **U4:** No service worker — offline shows a raw browser error page.
  Minimal offline fallback + cached shell. Also `start_url: "/schedule"`
  is wrong for Sales/Setter installs; use `/` + role landing.
- **U5:** Touch targets on newer screens too small (analytics chips ~26px,
  reconcile survivor radios 14px, GHL deep link is a tiny chip).
  `prompt()`/`confirm()` used for notes and destructive confirmations —
  reuse the bottom-sheet.
- **U6: Consistency debt:** select styling hand-copied ~15× at 3 heights
  (extract `ui/select`); five different `money()` formatters; duplicated
  TabButton/ErrorBox/Tag/Stat helpers; two modal implementations; color
  language inverted (new suites use semantic tokens, old screens hardcode
  emerald/amber); `leads-suite.tsx` at 983 lines needs a split; dark mode
  is dead code.
- **U7:** Lead phone field lacks `type="tel"`; no unsaved-changes warning
  on job-detail; disabled submits never say why.

## 4. Easy functionality wins

1. Job history on sub detail page — `GET /api/jobs?subId=` exists, unused.
2. Text search on the Jobs list (~15 lines, data already client-side).
3. Parameterize hardcoded windows (recently-booked 14d, scorecard 26w) as
   query params.
4. Triage tab counts recomputed client-side can diverge from server —
   return counts from the API.
5. Crew picker consistency: job-detail offers all subs; quick-edit and
   jobs-list filter to Active/Onboarding.

## 5. Missing safety net

Zero tests, no CI. Pure modules (`lib/leads/cadence.ts`,
`lib/jobs/staging.ts`, `lib/costing/dashboard.ts`,
`lib/analytics/scorecard.ts`, escape helper) are perfectly shaped for cheap
unit tests — every timezone/escaping bug above would have been caught.
~Half a day: vitest + ~6 spec files + GitHub Action running lint + tsc +
vitest on PRs.

## Order of attack

1. Security pass — role guards on data routes + schema route + headers
   (S1, S2, S6-headers).
2. Job-edit data-loss refactor — B1 + B2 + error surfacing (B3).
3. Airtable client hardening — shared escape helper + 429 retry (B4, B5),
   vitest baseline alongside.
4. Field-use UX batch — U1–U4.
5. Login rate limiting + stale-session fix (S3, S4), timezone helpers (B6),
   then easy wins and consistency cleanup.
