/**
 * Captures annotated screenshots of the HTP Production Manager
 * "Appointment Setter" screens against the local dev server, with all
 * /api/* data mocked at the browser network layer (no Airtable needed).
 */
import { chromium } from "playwright";
import crypto from "node:crypto";
import fs from "node:fs";

const BASE = "http://localhost:3100";
const OUT = new URL("./shots/", import.meta.url).pathname;
const AUTH_SECRET = "training-guide-screenshot-secret-0123456789abcdef";

fs.mkdirSync(OUT, { recursive: true });

/* ---- forge a session cookie (mirrors lib/auth.ts issueSession) ---------- */
function forgeSession(uid, roles) {
  const iat = Date.now();
  const exp = iat + 30 * 24 * 60 * 60 * 1000;
  const payload = `${uid}.${roles.join(",")}.${iat}.${exp}`;
  const sig = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

/* ---- mock data ----------------------------------------------------------- */
const now = Date.now();
const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;
const iso = (ms) => new Date(ms).toISOString();
const GHL = "https://app.gohighlevel.com/v2/location/htp/contacts/detail/";

const me = {
  user: {
    id: "recTim01",
    name: "Tim",
    email: "tim@hometownpaintingokc.com",
    roles: ["Office Admin"],
    active: true,
  },
};

const queueLeads = [
  {
    id: "leadNew1", name: "Sarah Mitchell",
    email: "sarah.mitchell@gmail.com", phone: "(405) 555-0134",
    source: "Google LSA", jobType: "Interior",
    status: "Open", createdAt: iso(now - 12 * MIN),
    contactAttempts: 0, ageDays: 0, overdue: true, queueState: "new",
    nextFollowUpDate: iso(now - 12 * MIN),
    ghlContactId: "c1", ghlUrl: GHL + "c1",
    notes: "Wants interior repaint — living room, kitchen, hallway. Prefers calls after 3pm.",
  },
  {
    id: "leadCb1", name: "James Porter",
    email: "jporter77@outlook.com", phone: "(405) 555-0177",
    source: "Website / Organic", jobType: "Exterior",
    status: "Open", createdAt: iso(now - 3 * DAY),
    firstContactedAt: iso(now - 3 * DAY + 2 * HOUR),
    lastContactedAt: iso(now - 2 * DAY),
    callbackAt: iso(now - 25 * MIN), nextFollowUpDate: iso(now - 25 * MIN),
    contactAttempts: 2, ageDays: 3, overdue: true, queueState: "callback",
    ghlContactId: "c2", ghlUrl: GHL + "c2",
    notes: "[7/22 2:15 PM] Asked us to call back today — checking spouse's schedule.\n[7/21 10:05 AM] Left voicemail.",
  },
  {
    id: "leadDue1", name: "Linda Alvarez",
    email: "linda.alvarez@icloud.com", phone: "(405) 555-0119",
    source: "Facebook", jobType: "Cabinets",
    status: "Open", createdAt: iso(now - 1.2 * DAY),
    firstContactedAt: iso(now - 26 * HOUR), lastContactedAt: iso(now - 26 * HOUR),
    nextFollowUpDate: iso(now - 2 * HOUR),
    contactAttempts: 1, ageDays: 1, overdue: true, queueState: "due",
    ghlContactId: "c3", ghlUrl: GHL + "c3",
    notes: "[7/23 9:40 AM] Left voicemail and a text.",
  },
  {
    id: "leadDec1", name: "Robert Chen",
    email: "rchen.okc@gmail.com", phone: "(405) 555-0242",
    source: "Google PPC", jobType: "Exterior",
    status: "Open", createdAt: iso(now - 14 * DAY),
    firstContactedAt: iso(now - 13 * DAY), lastContactedAt: iso(now - 3 * DAY),
    contactAttempts: 6, ageDays: 14, overdue: true, queueState: "decision",
    ghlContactId: "c4", ghlUrl: GHL + "c4",
    notes: "[7/21] Left voicemail #6 — no response to any attempt so far.",
  },
  {
    id: "leadWait1", name: "Emily Turner",
    email: "emily.t@gmail.com", phone: "(405) 555-0350",
    source: "Referral", jobType: "Interior",
    status: "Open", createdAt: iso(now - 6 * DAY),
    firstContactedAt: iso(now - 5 * DAY), lastContactedAt: iso(now - 1 * DAY),
    nextFollowUpDate: iso(now + 2 * DAY),
    contactAttempts: 3, ageDays: 6, overdue: false, queueState: "waiting",
    ghlContactId: "c5", ghlUrl: GHL + "c5",
    notes: "[7/23 4:10 PM] Spoke briefly — interested, asked us to try again next week.",
  },
];

const bookedLeads = [
  {
    id: "leadBk1", name: "Dana Carter", phone: "(405) 555-0408",
    source: "Google LSA", status: "Booked",
    createdAt: iso(now - 2 * DAY), bookedAt: iso(now - 1 * DAY),
    appointmentAt: iso(now + 1 * DAY + 2 * HOUR),
    contactAttempts: 1, ageDays: 2, overdue: false, queueState: "waiting",
    ghlContactId: "c6", ghlUrl: GHL + "c6",
  },
  {
    id: "leadBk2", name: "Miguel Santos", phone: "(405) 555-0466",
    source: "Referral", status: "Booked",
    createdAt: iso(now - 4 * DAY), bookedAt: iso(now - 2 * DAY),
    appointmentAt: iso(now + 3 * DAY + 5 * HOUR),
    contactAttempts: 2, ageDays: 4, overdue: false, queueState: "waiting",
    ghlContactId: "c7", ghlUrl: GHL + "c7",
  },
  {
    id: "leadBk3", name: "Rachel Kim", phone: "(405) 555-0521",
    source: "Website / Organic", status: "Booked",
    createdAt: iso(now - 6 * DAY), bookedAt: iso(now - 5 * DAY),
    contactAttempts: 1, ageDays: 6, overdue: false, queueState: "waiting",
    ghlContactId: "c8", ghlUrl: GHL + "c8",
  },
];

const findLeads = [
  { id: "f1", name: "Dana Carter", phone: "(405) 555-0408", email: "dana.carter@gmail.com", source: "Google LSA", status: "Booked", createdAt: iso(now - 2 * DAY), contactAttempts: 1, ageDays: 2, overdue: false, queueState: "waiting", ghlUrl: GHL + "c6" },
  { id: "f2", name: "Bill Carter", phone: "(405) 555-0913", email: "bcarter@aol.com", source: "Google PPC", status: "Disqualified", disqualifyReason: "Outside Service Area", createdAt: iso(now - 20 * DAY), contactAttempts: 1, ageDays: 20, overdue: false, queueState: "waiting" },
  { id: "f3", name: "Sue Carter-Hayes", phone: "(405) 555-0781", email: "sch@gmail.com", source: "Facebook", status: "Open", createdAt: iso(now - 1 * DAY), contactAttempts: 1, ageDays: 1, overdue: true, queueState: "due", ghlUrl: GHL + "c9" },
  { id: "f4", name: "John Carter", phone: "(405) 555-0655", email: "jc.okc@yahoo.com", source: "Website / Organic", status: "Abandoned", createdAt: iso(now - 45 * DAY), contactAttempts: 6, ageDays: 45, overdue: false, queueState: "waiting" },
];

const reconcileMissed = {
  ranAt: iso(now), windowDays: 30, ghlChecked: 214, matched: 212,
  gaps: [
    { ghlId: "ghlOppA1", ghlContactId: "cA1", name: "Peter Vance", email: "pvance@gmail.com", phone: "(405) 555-0899", source: "facebook form", status: "open", createdAt: iso(now - 3 * DAY), reason: "No Airtable opportunity with this GHL id" },
    { ghlId: "ghlOppA2", ghlContactId: "cA2", name: "Gloria Espinoza", email: "gespinoza@icloud.com", phone: "(405) 555-0722", source: "google lsa", status: "open", createdAt: iso(now - 6 * DAY), reason: "No Airtable opportunity with this GHL id" },
  ],
};

const reconcileProposals = {
  ranAt: iso(now), quotesChecked: 58, matched: 56,
  issues: [
    { kind: "missing", quoteNumber: 1247, name: "Held Residence", email: "sheld@gmail.com", psStatus: "sent", airtableOutcome: null, total: 4850, sentDate: "2026-07-18", detail: "Quote sent in PaintScout but no proposal recorded in Airtable." },
    { kind: "outcome-mismatch", quoteNumber: 1231, name: "Okafor Exterior", email: "d.okafor@gmail.com", psStatus: "accepted", airtableOutcome: "Lost", total: 7200, sentDate: "2026-07-10", detail: "PaintScout shows accepted; Airtable has it marked Lost." },
  ],
};

const reconcileDuplicates = {
  ranAt: iso(now),
  opportunities: [
    { ghlId: "ghlOppB7", rows: [
      { id: "recO1", label: "Kathy Brooks — Google LSA — 2026-07-19", extra: "Open · 2 contacts" },
      { id: "recO2", label: "Kathy Brooks — Needs Review — 2026-07-19", extra: "Open · 0 contacts" },
    ]},
  ],
  contacts: [
    { ghlId: "ghlCtC3", rows: [
      { id: "recC1", label: "Marcus Webb · (405) 555-0644", extra: "2 opportunities" },
      { id: "recC2", label: "Marcus Webb · mwebb@gmail.com", extra: "0 opportunities" },
    ]},
  ],
};

const sourceReview = {
  rows: [
    { id: "srcR1", name: "Tom Baker", email: "tom.baker@yahoo.com", rawSource: "fb-lead-form-v2", source: "Needs Review", createdAt: iso(now - 1 * DAY) },
    { id: "srcR2", name: "Alice Nguyen", email: "alice.nguyen@gmail.com", rawSource: "", source: "Needs Review", createdAt: iso(now - 2 * DAY) },
  ],
};

/* deterministic funnel rows */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const funnelRows = [];
const months = ["2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"];
const srcWeights = [["Google LSA", 10], ["Google PPC", 7], ["Website / Organic", 6], ["Facebook", 5], ["Referral", 4], ["Repeat Customer", 2]];
for (const m of months) {
  for (const [src, base] of srcWeights) {
    const n = Math.max(1, Math.round(base * (0.7 + rand() * 0.6)));
    for (let i = 0; i < n; i++) {
      const appt = rand() < 0.55;
      const proposal = appt && rand() < 0.7;
      const won = proposal && rand() < 0.45;
      funnelRows.push({
        source: src, leadMonth: m,
        apptMonth: appt ? m : "", proposalMonth: proposal ? m : "",
        wonMonth: won ? m : "",
        revenue: won ? Math.round(3000 + rand() * 6500) : 0,
        appt, proposal, won,
      });
    }
  }
}

/* ---- route mocks ---------------------------------------------------------- */
async function mockRoutes(page, { emptyQueue = false } = {}) {
  const json = (route, body) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  await page.route("**/api/auth/me", (r) => json(r, me));
  await page.route("**/api/leads/queue", (r) => json(r, { leads: emptyQueue ? [] : queueLeads }));
  await page.route("**/api/leads/recent", (r) => json(r, { leads: bookedLeads }));
  await page.route("**/api/leads/search**", (r) => json(r, { leads: findLeads }));
  await page.route("**/api/leads/import", (r) => json(r, { lead: queueLeads[0] }));
  await page.route(/\/api\/leads\/(?!queue|recent|search|import)[^/?]+$/, (r) => {
    if (r.request().method() === "PATCH") return json(r, { lead: queueLeads[0] });
    if (r.request().method() === "DELETE") return json(r, { ok: true });
    return r.continue();
  });
  await page.route("**/api/leads", (r) =>
    r.request().method() === "POST" ? json(r, { lead: queueLeads[0] }) : r.continue());
  await page.route("**/api/reconcile?**", (r) => json(r, reconcileMissed));
  await page.route("**/api/reconcile/proposals", (r) => json(r, reconcileProposals));
  await page.route("**/api/reconcile/duplicates", (r) => json(r, reconcileDuplicates));
  await page.route("**/api/sources/review", (r) => json(r, sourceReview));
  await page.route("**/api/sources/search**", (r) => json(r, sourceReview));
  await page.route("**/api/analytics/funnel", (r) => json(r, { rows: funnelRows }));
}

/* ---- annotation ----------------------------------------------------------- */
/** Draw numbered callouts over elements. items: [{loc, n, pad?, badge?}] */
async function annotate(page, items) {
  for (const it of items) {
    const box = await it.loc.boundingBox();
    if (!box) { console.warn(`  !! no box for callout ${it.n}`); continue; }
    const pad = it.pad ?? 4;
    await page.evaluate(
      ({ box, n, pad, badge }) => {
        const sx = window.scrollX, sy = window.scrollY;
        const mk = (styles) => {
          const d = document.createElement("div");
          d.className = "__anno";
          Object.assign(d.style, { position: "absolute", zIndex: 2147483000, pointerEvents: "none" }, styles);
          document.body.appendChild(d);
          return d;
        };
        mk({
          left: box.x + sx - pad + "px", top: box.y + sy - pad + "px",
          width: box.width + pad * 2 + "px", height: box.height + pad * 2 + "px",
          border: "3px solid #dc2626", borderRadius: "10px",
          boxShadow: "0 0 0 2px rgba(255,255,255,0.7)",
        });
        const B = 30;
        let bx, by;
        if (badge === "left") {
          bx = box.x + sx - pad - B - 6;
          by = box.y + sy - pad + (box.height + pad * 2 - B) / 2;
        } else if (badge === "below") {
          bx = box.x + sx + (box.width - B) / 2;
          by = box.y + sy + box.height + pad + 6;
        } else {
          bx = box.x + sx + box.width + pad - B / 2;
          by = box.y + sy - pad - B / 2;
        }
        const b = mk({
          left: bx + "px", top: by + "px", width: B + "px", height: B + "px",
          borderRadius: "50%", background: "#dc2626", color: "#fff",
          font: `700 16px/${B}px -apple-system, system-ui, sans-serif`,
          textAlign: "center", boxShadow: "0 1px 5px rgba(0,0,0,0.45), 0 0 0 2px #fff",
        });
        b.textContent = String(n);
      },
      { box, n: it.n, pad, badge: it.badge },
    );
  }
}
const clearAnno = (page) =>
  page.evaluate(() => document.querySelectorAll(".__anno").forEach((e) => e.remove()));

async function shot(page, name, opts = {}) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: OUT + name, ...opts });
  console.log("  ✓", name);
}

/** Clip rect (page coords) around a locator with margin. */
async function clipAround(page, loc, m = 16) {
  const box = await loc.boundingBox();
  const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  const vp = page.viewportSize();
  const x = Math.max(0, box.x + scroll.x - m);
  const y = Math.max(0, box.y + scroll.y - m);
  return { x, y, width: Math.min(vp.width - x + scroll.x, box.width + 2 * m), height: box.height + 2 * m + 60 };
}

/* ---- main ----------------------------------------------------------------- */
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({
  viewport: { width: 1360, height: 900 },
  deviceScaleFactor: 2,
  timezoneId: "America/Chicago",
});
await ctx.addCookies([{
  name: "htp_session",
  value: forgeSession("recTim01", ["Admin"]), // Admin passes middleware; UI roles come from mocked /api/auth/me
  url: BASE,
}]);

const page = await ctx.newPage();
await mockRoutes(page);
page.on("pageerror", (e) => console.warn("pageerror:", e.message));

/* -- 01 login (public page) -- */
console.log("login");
await page.goto(BASE + "/login", { waitUntil: "networkidle" });
await page.waitForSelector("#email");
await page.fill("#email", "tim@hometownpaintingokc.com");
await annotate(page, [
  { loc: page.locator("#email"), n: 1 },
  { loc: page.locator("#password"), n: 2 },
  { loc: page.locator('button[type="submit"]'), n: 3 },
]);
await shot(page, "01-login.png");
await clearAnno(page);

/* -- /leads: queue -- */
console.log("leads queue");
await page.goto(BASE + "/leads", { waitUntil: "networkidle" });
await page.waitForSelector("text=Sarah Mitchell");

/* 02: full page with nav */
await annotate(page, [
  { loc: page.locator("aside nav > div").first(), n: 1, pad: 2, badge: "below" },
  { loc: page.locator('div[role="tablist"]').first(), n: 2, badge: "below" },
  { loc: page.getByRole("button", { name: "New lead" }), n: 3, badge: "below" },
  { loc: page.locator('a[href*="localservices"]'), n: 4, badge: "below" },
]);
await shot(page, "02-overview.png");
await clearAnno(page);

/* 03: queue tab annotated */
const card = (name) => page.locator(`div.rounded-xl:has(> div span:text-is("${name}"))`).first();
const cardOf = (name) => page.locator("div.rounded-xl", { hasText: name }).first();
await annotate(page, [
  { loc: page.getByRole("tab", { name: /Work queue/ }), n: 1 },
  { loc: cardOf("Sarah Mitchell").locator("span", { hasText: "New — call now" }).first(), n: 2 },
  { loc: cardOf("James Porter").locator("span", { hasText: /Callback ·/ }).first(), n: 3 },
  { loc: cardOf("Robert Chen").locator("span", { hasText: /tries — decide/ }).first(), n: 4 },
  { loc: cardOf("Sarah Mitchell").locator('a[title="Open contact in GoHighLevel"]'), n: 5 },
]);
await shot(page, "03-queue.png");
await clearAnno(page);

/* 04: one card action row closeup */
const sarah = cardOf("Sarah Mitchell");
await annotate(page, [
  { loc: sarah.getByRole("button", { name: "Contacted" }), n: 1 },
  { loc: sarah.getByRole("button", { name: "Book", exact: true }), n: 2 },
  { loc: sarah.getByRole("button", { name: "Callback" }), n: 3 },
  { loc: sarah.getByRole("button", { name: "Disqualify" }), n: 4 },
  { loc: sarah.getByLabel("More"), n: 5 },
]);
await shot(page, "04-lead-card.png", { clip: await clipAround(page, sarah) });
await clearAnno(page);

/* 05: contacted panel */
await sarah.getByRole("button", { name: "Contacted" }).click();
await page.waitForSelector("text=What happened?");
await annotate(page, [
  { loc: sarah.locator('input[id^="note-"]'), n: 1 },
  { loc: sarah.getByRole("button", { name: "Log contact" }), n: 2 },
]);
await shot(page, "05-contacted.png", { clip: await clipAround(page, sarah) });
await clearAnno(page);
await sarah.getByRole("button", { name: "Cancel" }).click();

/* 06: book panel */
await sarah.getByRole("button", { name: "Book", exact: true }).click();
await page.waitForSelector('input[id^="appt-"]');
const apptDate = new Date(now + 2 * DAY); apptDate.setHours(10, 0, 0, 0);
await sarah.locator('input[id^="appt-"]').fill(apptDate.toISOString().slice(0, 16));
await annotate(page, [
  { loc: sarah.locator('input[id^="appt-"]'), n: 1 },
  { loc: sarah.getByRole("button", { name: "Confirm booking" }), n: 2 },
]);
await shot(page, "06-book.png", { clip: await clipAround(page, sarah) });
await clearAnno(page);
await sarah.getByRole("button", { name: "Cancel" }).click();

/* 07: callback panel */
await sarah.getByRole("button", { name: "Callback" }).click();
await page.waitForSelector('input[id^="cb-"]');
const cbDate = new Date(now + 1 * DAY); cbDate.setHours(15, 30, 0, 0);
await sarah.locator('input[id^="cb-"]').fill(cbDate.toISOString().slice(0, 16));
await sarah.locator('input[id^="cbnote-"]').fill("Asked us to call tomorrow afternoon");
await annotate(page, [
  { loc: sarah.locator('input[id^="cb-"]'), n: 1 },
  { loc: sarah.locator('input[id^="cbnote-"]'), n: 2 },
  { loc: sarah.getByRole("button", { name: "Set callback" }), n: 3 },
]);
await shot(page, "07-callback.png", { clip: await clipAround(page, sarah) });
await clearAnno(page);
await sarah.getByRole("button", { name: "Cancel" }).click();

/* 08: disqualify panel */
await sarah.getByRole("button", { name: "Disqualify" }).click();
await page.waitForSelector('select[id^="dq-"]');
await annotate(page, [
  { loc: sarah.locator('select[id^="dq-"]'), n: 1 },
  { loc: sarah.locator("div.rounded-md").getByRole("button", { name: "Disqualify" }), n: 2 },
]);
await shot(page, "08-disqualify.png", { clip: await clipAround(page, sarah) });
await clearAnno(page);
await sarah.getByRole("button", { name: "Cancel" }).click();

/* 09: more menu */
await sarah.getByLabel("More").click();
await page.waitForSelector("text=Mark reschedule");
await annotate(page, [
  { loc: sarah.locator("div.absolute.right-0"), n: 1, pad: 2, badge: "left" },
]);
const menuClip = await clipAround(page, sarah);
menuClip.height += 170;
await shot(page, "09-more-menu.png", { clip: menuClip });
await clearAnno(page);
await page.keyboard.press("Escape");
await page.mouse.click(30, 400); // close menu

/* 10: new lead form */
await page.getByRole("button", { name: "New lead" }).click();
await page.waitForSelector("text=First name");
const form = page.locator("div.rounded-xl", { hasText: "New lead" }).last();
await form.locator("input").nth(0).fill("Janet");
await form.locator("input").nth(1).fill("Miller");
await form.locator('input[type="email"]').fill("janet.miller@gmail.com");
await form.locator("input").nth(3).fill("(405) 555-0910");
await annotate(page, [
  { loc: form.locator("select").first(), n: 1 },
  { loc: form.locator("select").nth(1), n: 2 },
  { loc: form.getByRole("button", { name: "Add lead" }), n: 3 },
]);
await shot(page, "10-new-lead.png", { clip: await clipAround(page, form) });
await clearAnno(page);
await form.getByRole("button", { name: "Cancel" }).click();

/* 11: booked tab */
console.log("booked");
await page.getByRole("tab", { name: "Booked" }).click();
await page.waitForSelector("text=Dana Carter");
const danaRow = page.locator("div.px-4", { hasText: "Dana Carter" }).first();
await annotate(page, [
  { loc: page.getByRole("tab", { name: "Booked" }), n: 1 },
  { loc: danaRow.getByRole("button", { name: "Fix time" }), n: 2 },
  { loc: danaRow.getByRole("button", { name: "Reopen" }), n: 3 },
]);
await shot(page, "11-booked.png");
await clearAnno(page);

/* 12: missed tab */
console.log("missed");
await page.getByRole("tab", { name: "Missed" }).click();
await page.waitForSelector("text=Run sweep");
await page.getByRole("button", { name: /Run sweep/ }).click();
await page.waitForSelector("text=Peter Vance");
await annotate(page, [
  { loc: page.getByRole("button", { name: /Run sweep/ }), n: 1 },
  { loc: page.getByRole("button", { name: "Import" }).first(), n: 2 },
]);
await shot(page, "12-missed.png");
await clearAnno(page);

/* 13: find tab */
console.log("find");
await page.getByRole("tab", { name: "Find" }).click();
await page.waitForSelector('input[placeholder*="Name, email"]');
await page.fill('input[placeholder*="Name, email"]', "carter");
await page.getByRole("button", { name: "Search", exact: true }).click();
await page.waitForSelector("text=Bill Carter");
await annotate(page, [
  { loc: page.locator('input[placeholder*="Name, email"]'), n: 1 },
  { loc: page.locator("li", { hasText: "Bill Carter" }).locator("span.rounded-full").first(), n: 2 },
  { loc: page.locator("li", { hasText: "Bill Carter" }).getByRole("button", { name: "Reopen" }), n: 3 },
]);
await shot(page, "13-find.png");
await clearAnno(page);

/* 14: empty queue (what "done" looks like) */
console.log("empty queue");
const page2 = await ctx.newPage();
await mockRoutes(page2, { emptyQueue: true });
await page2.goto(BASE + "/leads", { waitUntil: "networkidle" });
await page2.waitForSelector("text=Queue is clear");
await shot(page2, "14-queue-clear.png");
await page2.close();

/* 15: sources — fix tab */
console.log("sources");
await page.goto(BASE + "/sources", { waitUntil: "networkidle" });
await page.waitForSelector("text=Tom Baker");
const tomRow = page.locator("div.rounded-xl", { hasText: "Tom Baker" }).first();
await tomRow.locator("select").selectOption("Facebook");
await tomRow.locator('input[type="checkbox"]').check();
await annotate(page, [
  { loc: page.getByRole("tab", { name: /Fix sources/ }), n: 1 },
  { loc: tomRow.locator("code"), n: 2 },
  { loc: tomRow.locator("select"), n: 3, badge: "left" },
  { loc: tomRow.locator("label", { hasText: "Remember" }), n: 4, badge: "below" },
  { loc: tomRow.getByRole("button", { name: "Save" }), n: 5 },
]);
await shot(page, "15-sources-fix.png");
await clearAnno(page);

/* 16: sources — funnel tab */
await page.getByRole("tab", { name: "Funnel" }).click();
await page.waitForSelector("text=All time");
await annotate(page, [
  { loc: page.locator("div.inline-flex", { hasText: "By month" }).first(), n: 1 },
  { loc: page.locator("select").first(), n: 2 },
  { loc: page.locator("div.inline-flex", { hasText: "When it happened" }).last(), n: 3 },
]);
await shot(page, "16-sources-funnel.png");
await clearAnno(page);

/* 17: reconcile */
console.log("reconcile");
await page.goto(BASE + "/reconcile", { waitUntil: "networkidle" });
await page.waitForSelector("text=Missed leads");
for (const b of await page.getByRole("button", { name: "Run", exact: true }).all()) await b.click();
await page.waitForSelector("text=Peter Vance");
await page.waitForSelector("text=Kathy Brooks");
await annotate(page, [
  { loc: page.locator("div.rounded-xl", { hasText: "Missed leads" }).first().getByRole("button", { name: "Run" }), n: 1 },
  { loc: page.locator("div.rounded-xl", { hasText: "Missed leads" }).first().locator("div.mt-3").first(), n: 2 },
]);
await shot(page, "17-reconcile.png", { fullPage: true });
await clearAnno(page);

/* 18: mobile queue */
console.log("mobile");
const mctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  timezoneId: "America/Chicago",
});
await mctx.addCookies([{ name: "htp_session", value: forgeSession("recTim01", ["Admin"]), url: BASE }]);
const mpage = await mctx.newPage();
await mockRoutes(mpage);
await mpage.goto(BASE + "/leads", { waitUntil: "networkidle" });
await mpage.waitForSelector("text=Sarah Mitchell");
await annotate(mpage, [
  { loc: mpage.locator('nav[aria-label*="pages"]'), n: 1, pad: 2 },
]);
await shot(mpage, "18-mobile.png");

await browser.close();
console.log("DONE");
