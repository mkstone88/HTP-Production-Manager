# Appointment Center Welcome Guide

`Appointment-Center-Welcome-Guide.pdf` is the training guide for new
appointment setters (Leads / Sources / Reconcile). Print it or send it
directly — it assumes no prior knowledge of the app, only of the company's
lead intake process.

## Regenerating after UI changes

The screenshots are captured from the real app running locally, with all
`/api/*` responses mocked at the browser network layer — no Airtable
credentials needed.

1. Start the dev server with a known `AUTH_SECRET`:

   ```bash
   # .env.local needs AUTH_SECRET=training-guide-screenshot-secret-0123456789abcdef
   # (any Airtable values may be dummies; the API is never actually hit)
   npm run dev -- --port 3100
   ```

2. Capture annotated screenshots (writes to `./shots/`):

   ```bash
   npm install playwright   # in a scratch dir, not this repo
   node capture-screenshots.mjs
   ```

   The script forges a session cookie (mirroring `lib/auth.ts`), mocks every
   API route with realistic sample data, drives each screen with Playwright,
   and draws the red numbered callouts in-page before screenshotting.

3. Build the PDF (expects `./shots/` next to the script):

   ```bash
   pip install reportlab pillow
   python3 build_pdf.py
   ```

If UI copy or workflows change, update the callout keys and body text in
`build_pdf.py` to match — the callout numbers in the text correspond to the
numbered badges drawn by `capture-screenshots.mjs`.
