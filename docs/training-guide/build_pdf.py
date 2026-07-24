#!/usr/bin/env python3
"""Build the Appointment Center Welcome Guide PDF from annotated screenshots."""
import os

from PIL import Image as PILImage, ImageDraw, ImageFont
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate, Frame, Image, KeepTogether, NextPageTemplate, PageBreak,
    PageTemplate, Paragraph, Spacer, Table, TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, "shots")
OUT = os.path.join(HERE, "Appointment-Center-Welcome-Guide.pdf")
LOGO = "/home/user/HTP-Production-Manager/public/branding/logo.jpg"

NAVY = colors.HexColor("#1d294f")
RED = colors.HexColor("#c62828")
LIGHT = colors.HexColor("#f2f5fa")
WARN_BG = colors.HexColor("#fdf3e3")
WARN_EDGE = colors.HexColor("#d97706")
TIP_BG = colors.HexColor("#eaf4ec")
TIP_EDGE = colors.HexColor("#2e7d32")
GRAY = colors.HexColor("#5a6472")

PAGE_W, PAGE_H = letter
MARGIN = 0.75 * inch
CONTENT_W = PAGE_W - 2 * MARGIN

# ---- inline red badge images (match the screenshot callouts) -----------------
BADGE_DIR = os.path.join(HERE, "badges")
os.makedirs(BADGE_DIR, exist_ok=True)


def badge_path(n: int) -> str:
    p = os.path.join(BADGE_DIR, f"b{n}.png")
    if not os.path.exists(p):
        s = 64
        im = PILImage.new("RGBA", (s, s), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.ellipse([2, 2, s - 2, s - 2], fill=(198, 40, 40, 255))
        try:
            font = ImageFont.truetype(
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 38)
        except OSError:
            font = ImageFont.load_default()
        t = str(n)
        bb = d.textbbox((0, 0), t, font=font)
        d.text(((s - bb[2] - bb[0]) / 2, (s - bb[3] - bb[1]) / 2 - 2), t,
               font=font, fill="white")
        im.save(p)
    return p


# ---- styles -------------------------------------------------------------------
ss = getSampleStyleSheet()
styles = {
    "title": ParagraphStyle("title", parent=ss["Title"], fontSize=30, leading=36,
                            textColor=NAVY, spaceAfter=6),
    "subtitle": ParagraphStyle("subtitle", parent=ss["Normal"], fontSize=15,
                               leading=20, alignment=TA_CENTER, textColor=GRAY),
    "h1": ParagraphStyle("h1", parent=ss["Heading1"], fontSize=19, leading=24,
                         textColor=NAVY, spaceBefore=6, spaceAfter=8),
    "h2": ParagraphStyle("h2", parent=ss["Heading2"], fontSize=13.5, leading=17,
                         textColor=RED, spaceBefore=12, spaceAfter=4),
    "body": ParagraphStyle("body", parent=ss["Normal"], fontSize=10.5,
                           leading=15.5, spaceAfter=7),
    "step": ParagraphStyle("step", parent=ss["Normal"], fontSize=10.5,
                           leading=15.5, leftIndent=22, bulletIndent=6,
                           spaceAfter=5),
    "key": ParagraphStyle("key", parent=ss["Normal"], fontSize=10, leading=14),
    "caption": ParagraphStyle("caption", parent=ss["Normal"], fontSize=9,
                              leading=12, alignment=TA_CENTER, textColor=GRAY,
                              spaceBefore=4, spaceAfter=12),
    "boxbody": ParagraphStyle("boxbody", parent=ss["Normal"], fontSize=10,
                              leading=14),
    "toch": ParagraphStyle("toch", parent=ss["Heading1"], fontSize=19,
                           textColor=NAVY),
}


def P(text, style="body"):
    return Paragraph(text, styles[style])


def steps(items):
    return [Paragraph(f"<b>{i}.</b> {t}", styles["step"])
            for i, t in enumerate(items, 1)]


def bullets(items):
    return [Paragraph(t, styles["step"], bulletText="•") for t in items]


def shot(name, width=CONTENT_W, caption=None):
    """Full-width (or scaled) screenshot with optional caption."""
    path = os.path.join(SHOTS, name)
    im = PILImage.open(path)
    w, h = im.size
    scale = width / w
    flow = [Image(path, width=width, height=h * scale)]
    if caption:
        flow.append(Paragraph(caption, styles["caption"]))
    return flow


def callout_key(rows):
    """Numbered-badge legend matching the red callouts in a screenshot."""
    data = []
    for n, text in rows:
        data.append([Image(badge_path(n), width=13, height=13),
                     Paragraph(text, styles["key"])])
    t = Table(data, colWidths=[22, CONTENT_W - 30], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (0, -1), 0),
    ]))
    return t


def box(kind, title, text):
    bg, edge = (TIP_BG, TIP_EDGE) if kind == "tip" else (WARN_BG, WARN_EDGE)
    inner = Paragraph(f"<b>{title}</b><br/>{text}", styles["boxbody"])
    t = Table([[inner]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("BOX", (0, 0), (-1, -1), 1, edge),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return [Spacer(1, 4), t, Spacer(1, 10)]


class Guide(BaseDocTemplate):
    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and flowable.style.name == "h1":
            text = flowable.getPlainText()
            self.notify("TOCEntry", (0, text, self.page))
            key = f"s-{text}"
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(text, key, 0)


def on_page(canv, doc):
    canv.saveState()
    canv.setFont("Helvetica", 8)
    canv.setFillColor(GRAY)
    canv.drawString(MARGIN, 0.45 * inch,
                    "HTP Production Manager — Appointment Center Welcome Guide")
    canv.drawRightString(PAGE_W - MARGIN, 0.45 * inch, f"Page {doc.page}")
    canv.setStrokeColor(colors.HexColor("#d8dee8"))
    canv.line(MARGIN, 0.58 * inch, PAGE_W - MARGIN, 0.58 * inch)
    canv.restoreState()


def on_cover(canv, doc):
    pass


doc = Guide(OUT, pagesize=letter, leftMargin=MARGIN, rightMargin=MARGIN,
            topMargin=MARGIN, bottomMargin=0.85 * inch,
            title="Appointment Center Welcome Guide",
            author="Hometown Painting")
frame = Frame(MARGIN, 0.85 * inch, CONTENT_W, PAGE_H - MARGIN - 0.85 * inch,
              id="main")
cover_frame = Frame(MARGIN, MARGIN, CONTENT_W, PAGE_H - 2 * MARGIN, id="cover")
doc.addPageTemplates([
    PageTemplate(id="Cover", frames=[cover_frame], onPage=on_cover),
    PageTemplate(id="Main", frames=[frame], onPage=on_page),
])

story = []

# ================================ COVER =======================================
logo = PILImage.open(LOGO)
lw = 3.1 * inch
story += [
    Spacer(1, 1.5 * inch),
    Image(LOGO, width=lw, height=logo.size[1] * lw / logo.size[0], hAlign="CENTER"),
    Spacer(1, 0.5 * inch),
    Paragraph("Appointment Center<br/>Welcome Guide", ParagraphStyle(
        "cov", parent=styles["title"], alignment=TA_CENTER, fontSize=32,
        leading=40)),
    Spacer(1, 0.25 * inch),
    Paragraph("How to work leads, book appointments, and keep our<br/>"
              "lead pipeline clean in the HTP Production Manager app",
              styles["subtitle"]),
    Spacer(1, 2.2 * inch),
    Paragraph("For: Appointment Setters (new users)<br/>"
              "Covers: Leads · Sources · Reconcile<br/>"
              "July 2026 · v1", styles["subtitle"]),
    NextPageTemplate("Main"),
    PageBreak(),
]

# ============================ TABLE OF CONTENTS ================================
toc = TableOfContents()
toc.levelStyles = [ParagraphStyle("toc1", fontSize=11, leading=20,
                                  leftIndent=6, textColor=NAVY)]
story += [Paragraph("Contents", styles["toch"]), Spacer(1, 10), toc, PageBreak()]

# ============================ 1. WELCOME ======================================
story += [
    P("1. Welcome — what this app is", "h1"),
    P("The <b>HTP Production Manager</b> is our company's own app for running "
      "day-to-day operations. You already know our lead intake process — leads "
      "come in from Google Local Services, Google Ads, our website, Facebook, "
      "and referrals, and they land in <b>GoHighLevel (GHL)</b>. This app sits "
      "on top of that process and gives you one thing GHL doesn't: "
      "<b>a single, prioritized work queue</b> that tells you exactly who to "
      "call next, remembers every follow-up for you, and tracks what happened "
      "to every lead."),
    P("As an appointment setter you'll live in the <b>Appointment Setter</b> "
      "section of the app, which has three pages:"),
    *bullets([
        "<b>Leads</b> — your daily work queue. New leads to call, follow-ups "
        "that are due, callbacks the customer asked for, and the history of "
        "everything you've booked.",
        "<b>Sources</b> — a small cleanup screen where you make sure every "
        "lead is credited to the right marketing source (this is how we know "
        "which advertising actually pays for itself).",
        "<b>Reconcile</b> — a safety net that cross-checks our systems so no "
        "lead ever falls through the cracks.",
    ]),
    *box("warn", "The #1 house rule — all customer contact happens in GoHighLevel.",
         "This app never places calls or sends texts, and that's on purpose. "
         "When it's time to reach a customer, click the <b>GHL</b> button on "
         "their lead card — it opens their contact in GoHighLevel, and you "
         "call or text from there so every conversation is recorded in one "
         "place. Phone numbers shown in the app are for reference only. "
         "Email is fine <i>only</i> from your @hometownpaintingokc.com "
         "address (work email syncs into GHL automatically)."),
    P("Everything you do in the app — logging a call, booking, disqualifying — "
      "is saved instantly to the company database (Airtable) that the sales "
      "and production teams also work from. When you book an appointment "
      "here, the whole company can see it. That's why using the app "
      "consistently matters: it's the one source of truth."),
    PageBreak(),
]

# ============================ 2. SIGNING IN ===================================
story += [
    P("2. Signing in", "h1"),
    P("Open the app in your browser (Matt will send you the link) and you'll "
      "land on the sign-in page."),
    *shot("01-login.png", CONTENT_W * 0.9,
          "Figure 1 — The sign-in page."),
    callout_key([
        (1, "<b>Email</b> — your @hometownpaintingokc.com work email."),
        (2, "<b>Password</b> — set up by Matt when your account was created. "
            "You can change it later under <b>Account</b> (bottom of the "
            "sidebar)."),
        (3, "<b>Sign in</b> — takes you straight to your Leads queue."),
    ]),
    Spacer(1, 6),
    *box("tip", "Put it on your phone like an app.",
         "The Production Manager is a mobile-first web app (PWA). On your "
         "phone, open the link in Safari/Chrome and choose <b>Add to Home "
         "Screen</b>. It then opens full-screen like a regular app — perfect "
         "for logging a call you just made from GHL's mobile app. You stay "
         "signed in for 30 days."),
    P("On a phone the same pages appear with the navigation pills across the "
      "top instead of a sidebar:"),
    *shot("18-mobile.png", CONTENT_W * 0.42,
          "Figure 2 — The Leads queue on a phone. The Leads / Sources / "
          "Reconcile pills (boxed) replace the sidebar."),
    PageBreak(),
]

# ============================ 3. GETTING AROUND ================================
story += [
    P("3. Finding your way around", "h1"),
    *shot("02-overview.png", CONTENT_W,
          "Figure 3 — The Leads page, your home base."),
    callout_key([
        (1, "<b>Sidebar</b> — the Appointment Setter section with your three "
            "pages: Leads, Sources, Reconcile. Below the sidebar (scroll "
            "down) are your name, <b>Account</b> (change password), and "
            "<b>Log out</b>."),
        (2, "<b>Tabs</b> — the Leads page has four tabs: <b>Work queue</b> "
            "(who to contact now), <b>Booked</b> (recent appointments), "
            "<b>Missed</b> (leads stuck in GHL that never made it into the "
            "app), and <b>Find</b> (search everything). The orange number on "
            "Work queue is how many leads currently need attention."),
        (3, "<b>New lead</b> — add a lead by hand (phone-ins, or LSA leads "
            "you've worked in Google's dashboard). See Section 7."),
        (4, "<b>Google LSA</b> — opens Google's Local Services Ads dashboard "
            "in a new tab. Some LSA leads arrive with only a message and no "
            "phone/email — those are worked in Google's dashboard first, "
            "then added here once you have real contact info."),
    ]),
    PageBreak(),
]

# ============================ 4. THE WORK QUEUE ================================
story += [
    P("4. The Work Queue — your day, already sorted", "h1"),
    P("The Work queue shows every lead that still needs an outcome — nothing "
      "you've finished, nothing that's asleep until later clutters the top. "
      "The app sorts it for you, so the rule is simple: <b>start at the top "
      "and work down.</b> It refreshes itself every minute, so new leads pop "
      "in without reloading the page."),
    *shot("03-queue.png", CONTENT_W,
          "Figure 4 — The Work queue. Colored chips explain why each lead is "
          "where it is."),
    callout_key([
        (1, "<b>Work queue tab with badge</b> — \"4\" means four leads need "
            "attention right now. \"5 open · 4 need attention\" repeats that "
            "below: 5 leads are in play, 4 are due."),
        (2, "<b>New — call now</b> (green) — a brand-new lead nobody has "
            "touched. These always sort to the very top, newest first. Speed "
            "matters: the odds of reaching a lead collapse within the first "
            "hour, so call these the moment you see them."),
        (3, "<b>Callback</b> (orange) — the customer asked to be called at a "
            "specific time, and that time has arrived. These rank right "
            "below new leads."),
        (4, "<b>6 tries — decide</b> (red) — you've made the maximum number "
            "of attempts. The app stops scheduling more retries and asks you "
            "to make a decision: book them, disqualify them, or abandon "
            "them. Don't let these sit."),
        (5, "<b>GHL button</b> — opens this customer in GoHighLevel. This is "
            "where you actually place the call or send the text."),
    ]),
    Spacer(1, 4),
    P("A fourth chip you'll see is <b>Follow-up due</b> (orange clock) — a "
      "lead you've contacted before whose next scheduled touch has come due. "
      "Leads with nothing due yet sit at the bottom with a gray \"Next …\" "
      "chip; you can ignore them until the app surfaces them."),
    P("How the follow-up schedule works", "h2"),
    P("Every time you log a contact attempt, the app schedules the next one "
      "for you — you never have to remember who to chase. The gaps stretch "
      "out as attempts add up:"),
]
cad = Table(
    [["After attempt…", "1", "2", "3", "4", "5", "6"],
     ["Next follow-up due in", "1 day", "1 day", "1 day", "2 days", "2 days",
      "decide"]],
    colWidths=[1.75 * inch] + [0.79 * inch] * 6, hAlign="LEFT")
cad.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTNAME", (0, 1), (0, 1), "Helvetica-Bold"),
    ("FONTSIZE", (0, 0), (-1, -1), 9.5),
    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#c4ccd8")),
    ("BACKGROUND", (0, 1), (-1, 1), LIGHT),
    ("ALIGN", (1, 0), (-1, -1), "CENTER"),
    ("TOPPADDING", (0, 0), (-1, -1), 5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
]))
story += [
    cad,
    Spacer(1, 8),
    P("A brand-new lead is due <b>immediately</b>. After the 6th attempt the "
      "cadence is exhausted and the card turns red: make the call — Book, "
      "Disqualify, or Abandon (Section 6). A customer-requested "
      "<b>Callback</b> overrides all of this: the lead sleeps until the "
      "time they asked for, then jumps near the top."),
    *box("tip", "The queue empties — that's the goal.",
         "When every lead has an outcome or a scheduled future touch, the "
         "queue shows \"Queue is clear.\" An empty queue doesn't mean no "
         "work exists — it means you're fully caught up. That's what a good "
         "day looks like."),
    PageBreak(),
    P("Anatomy of a lead card", "h2"),
    *shot("04-lead-card.png", CONTENT_W,
          "Figure 5 — Every card carries the lead's contact info, source, "
          "job type, age, attempt count, and notes. The action buttons along "
          "the bottom are how you work it."),
    callout_key([
        (1, "<b>Contacted</b> — log that you just tried to reach them "
            "(call, text, or spoke). Schedules the next follow-up "
            "automatically."),
        (2, "<b>Book</b> (green) — they agreed to an appointment. The win "
            "button."),
        (3, "<b>Callback</b> — they asked to be contacted at a specific "
            "time."),
        (4, "<b>Disqualify</b> — not a fit (out of area, too small, etc.)."),
        (5, "<b>\"...\" (More)</b> — extra actions: add a note, mark "
            "reschedule, abandon, or delete spam."),
    ]),
    Spacer(1, 4),
    P("Tap the notes text to expand it — newest note is always on top, and "
      "every note is stamped with the date."),
]

# ============================ 5/6. WORKING A LEAD ==============================
story += [
    PageBreak(),
    P("5. Working a lead — the four main actions", "h1"),
    P("The rhythm for every lead in the queue: open their <b>GHL</b> page, "
      "make the call or send the text there, then come back to the app and "
      "record what happened using one of the four buttons. Ten seconds of "
      "logging keeps the whole queue honest."),
    P("A. \"Contacted\" — log an attempt", "h2"),
    *shot("05-contacted.png", CONTENT_W,
          "Figure 6 — Logging a contact attempt."),
    callout_key([
        (1, "<b>What happened?</b> (optional) — one line like \"Left "
            "voicemail\" or \"Spoke — wants exterior quote.\" It's saved to "
            "the lead's notes with today's date."),
        (2, "<b>Log contact</b> — bumps the attempt counter, stamps the "
            "time, and schedules the next follow-up per the table in "
            "Section 4."),
    ]),
    Spacer(1, 4),
    P("Log <b>every</b> attempt, even unanswered ones — the attempt counter "
      "is what drives the queue's schedule, and it's also proof of how hard "
      "we worked a lead."),
    PageBreak(),
    P("B. \"Book\" — the goal", "h2"),
    *shot("06-book.png", CONTENT_W,
          "Figure 7 — Booking an appointment."),
    callout_key([
        (1, "<b>Appointment date &amp; time</b> (optional but strongly "
            "encouraged) — when the estimate visit is scheduled."),
        (2, "<b>Confirm booking</b> — moves the lead out of the queue and "
            "onto the Booked tab."),
    ]),
    Spacer(1, 4),
    *box("warn", "Book the appointment in GHL's calendar too.",
         "This button records the outcome for our tracking — it does not "
         "send the customer a calendar invite or reminders. Book the actual "
         "appointment in GoHighLevel the way you do today, then confirm it "
         "here."),
    PageBreak(),
    P("C. \"Callback\" — they asked for a specific time", "h2"),
    *shot("07-callback.png", CONTENT_W,
          "Figure 8 — Scheduling a customer-requested callback."),
    callout_key([
        (1, "<b>Call them back at</b> — the date and time the customer "
            "asked for. Required."),
        (2, "<b>Note</b> (optional) — why, e.g. \"back from vacation "
            "Monday.\""),
        (3, "<b>Set callback</b> — the lead goes quiet until that moment, "
            "then surfaces near the top of the queue with an orange "
            "Callback chip."),
    ]),
    Spacer(1, 4),
    P("D. \"Disqualify\" — a polite no", "h2"),
    *shot("08-disqualify.png", CONTENT_W,
          "Figure 9 — Disqualifying with a reason."),
    callout_key([
        (1, "<b>Reason</b> — pick the one that fits: <b>Outside Service "
            "Area</b>, <b>Project Too Small</b>, <b>Price-Only Shopper</b>, "
            "<b>Timing</b>, or <b>Wrong Service Type</b>. These feed our "
            "marketing reports, so choose honestly."),
        (2, "<b>Disqualify</b> — removes the lead from the queue and records "
            "the reason. Reversible later from the Find tab if they come "
            "back around."),
    ]),
    PageBreak(),
    P("6. The \"...\" menu — notes, reschedules, abandoning, spam", "h1"),
    *shot("09-more-menu.png", CONTENT_W,
          "Figure 10 — The overflow menu on every card."),
    callout_key([
        (1, "The four extra actions, top to bottom — see below."),
    ]),
    Spacer(1, 4),
    *bullets([
        "<b>Add note</b> — jot something down <i>without</i> counting a "
        "contact attempt (e.g. \"neighbor says they're out of town\").",
        "<b>Mark reschedule</b> — a booked appointment fell through and this "
        "lead needs a new time. It comes back into the queue wearing a "
        "\"Reschedule\" tag so you know the history.",
        "<b>Abandon</b> — you exhausted the attempts (or the number is dead) "
        "and they never responded. The lead leaves the queue but stays in "
        "the system, searchable and reopenable forever.",
        "<b>Delete (junk)</b> — <font color='#c62828'><b>permanent</b></font> "
        "removal. Only for spam and bogus entries — never for a real person "
        "who just didn't answer. If a human was ever on the other end, use "
        "Abandon or Disqualify instead.",
    ]),
    P("How to decide at 6 tries: if you ever actually spoke and they're a "
      "fit → keep pushing or set a Callback. Never reached them at all → "
      "<b>Abandon</b>. Reached them and they're not a fit → "
      "<b>Disqualify</b> with the right reason."),
]

# ============================ 7. NEW LEAD ======================================
story += [
    PageBreak(),
    P("7. Adding a lead by hand", "h1"),
    P("Most leads flow in automatically (Zapier pushes them from our forms, "
      "ads, and GHL bookings). You add one manually when someone <b>calls "
      "in directly</b>, when you meet someone in the field, or when a "
      "<b>Google LSA</b> lead that only had a message finally gives you "
      "their contact info in Google's dashboard."),
    *shot("10-new-lead.png", CONTENT_W,
          "Figure 11 — The New lead form (opens from the New lead button, "
          "top right)."),
    callout_key([
        (1, "<b>Source</b> — where this lead actually came from: Google "
            "LSA, Google PPC, Website / Organic, Facebook, Referral, Repeat "
            "Customer, BNI, B2B, Job Site, AI / LLM, or Other. Getting this "
            "right is how our marketing dollars get measured — when in "
            "doubt, ask the customer \"how did you hear about us?\""),
        (2, "<b>Job type</b> — Interior, Exterior, Cabinets, Staining, or "
            "Other, if you know it."),
        (3, "<b>Add lead</b> — creates the lead as brand-new, due "
            "immediately, at the top of the queue."),
    ]),
    Spacer(1, 4),
    *box("tip", "No duplicate customers.",
         "If the email you enter matches an existing customer, the app links "
         "the new lead to that same person instead of creating a copy — so "
         "don't worry about whether they already exist."),
]

# ============================ 8. BOOKED TAB ====================================
story += [
    PageBreak(),
    P("8. The Booked tab — your recent wins", "h1"),
    P("Everything you've booked in the last two weeks, newest first. Use it "
      "to double-check appointment times and to recover when plans change. "
      "(Older bookings are always findable under Find.)"),
    *shot("11-booked.png", CONTENT_W,
          "Figure 12 — Recently booked appointments."),
    callout_key([
        (1, "<b>Booked tab</b> — the appointment date/time shows on the "
            "right of each row."),
        (2, "<b>Fix time</b> — typo or the customer moved it an hour? "
            "Correct the appointment time in place."),
        (3, "<b>Reopen</b> — the booking fell through entirely. Puts the "
            "lead straight back into the Work queue, due now, so it doesn't "
            "get forgotten."),
    ]),
]

# ============================ 9. MISSED TAB ====================================
story += [
    PageBreak(),
    P("9. The Missed tab — catching leads stuck in GHL", "h1"),
    P("Occasionally a lead exists in GoHighLevel but never made it into our "
      "system (an automation hiccup, an odd form, a manual GHL entry). The "
      "Missed tab finds them. A sweep also runs <b>automatically every "
      "night</b> and imports anything it finds — this tab is the manual "
      "version for when you don't want to wait."),
    *shot("12-missed.png", CONTENT_W,
          "Figure 13 — The Missed tab after running a sweep."),
    callout_key([
        (1, "<b>Run sweep (30d)</b> — compares the last 30 days of GHL "
            "leads against our records and lists anyone missing."),
        (2, "<b>Import</b> — pulls that lead in and drops them into the "
            "Work queue as a new lead, due immediately."),
    ]),
    Spacer(1, 4),
    P("A good habit: run a sweep Monday morning. Most days it will say "
      "\"Nothing missed\" — that's the system working."),
]

# ============================ 10. FIND TAB =====================================
story += [
    PageBreak(),
    P("10. The Find tab — search everything, undo anything", "h1"),
    P("Find searches <b>every</b> lead ever — open, booked, disqualified, "
      "abandoned — by name, email, or phone. Use it when a customer calls "
      "back months later, when you need to check what happened to someone, "
      "or when you disqualified the wrong person."),
    *shot("13-find.png", CONTENT_W,
          "Figure 14 — Searching all leads from the Find tab."),
    callout_key([
        (1, "<b>Search box</b> — type at least two characters of a name, "
            "email, or phone number and hit Search."),
        (2, "<b>Status chip</b> — shows where each lead ended up, including "
            "the disqualify reason."),
        (3, "<b>Reopen</b> — brings a closed or booked lead back into the "
            "Work queue, due now. This is the universal undo."),
    ]),
    Spacer(1, 4),
    P("And when the queue is fully worked, here's the payoff:"),
    *shot("14-queue-clear.png", CONTENT_W,
          "Figure 15 — A clear queue: every lead has an outcome or a "
          "scheduled future touch."),
]

# ============================ 11. SOURCES ======================================
story += [
    PageBreak(),
    P("11. Sources — keeping marketing data honest", "h1"),
    P("Every lead should be credited to the marketing source that produced "
      "it. Automated leads sometimes arrive with a blank or cryptic source "
      "(like <font face='Courier'>fb-lead-form-v2</font>). The Sources page "
      "is where you clean those up — it takes about a minute a day and it's "
      "how Matt knows which advertising to keep paying for."),
    *shot("15-sources-fix.png", CONTENT_W,
          "Figure 16 — The Fix sources tab."),
    callout_key([
        (1, "<b>Fix sources tab</b> — the badge shows how many leads are "
            "waiting for review."),
        (2, "<b>Raw source</b> — the machine value that came in with the "
            "lead (or \"— blank raw —\" if there was none)."),
        (3, "<b>Set source</b> — pick the real source from our standard "
            "list."),
        (4, "<b>Remember</b> — tick this and the app maps that raw value to "
            "your choice <b>forever</b>: every future lead arriving with "
            "the same raw tag is fixed automatically, and any other pending "
            "ones are corrected on the spot."),
        (5, "<b>Save</b> — apply it."),
    ]),
    Spacer(1, 4),
    P("The \"Correct a specific lead\" search below it lets you fix a source "
      "on any lead, even ones that aren't flagged."),
    PageBreak(),
    P("The Funnel tab (read-only)", "h2"),
    *shot("16-sources-funnel.png", CONTENT_W,
          "Figure 17 — The Funnel: leads → appointments → proposals → sold, "
          "by month or by source."),
    callout_key([
        (1, "<b>By month / By source</b> — view rows as months, or as "
            "sources for one selected month."),
        (2, "<b>Lead source filter</b> — narrow the month view to a single "
            "source."),
        (3, "<b>When it happened / Lead cohort</b> — two ways of counting "
            "(the footnote on-screen explains both)."),
    ]),
    Spacer(1, 4),
    P("You don't have to do anything here — but <b>Book %</b> (appointments "
      "÷ leads) is your personal scoreboard, and clean source data from the "
      "Fix tab is what makes these numbers trustworthy."),
]

# ============================ 12. RECONCILE ====================================
story += [
    PageBreak(),
    P("12. Reconcile — the safety net", "h1"),
    P("Reconcile cross-checks our systems against each other so nothing "
      "quietly goes missing. The sweeps only <b>report</b> — running them "
      "changes nothing (the one exception is resolving duplicates, below). "
      "Run them weekly, or whenever something feels off."),
    *shot("17-reconcile.png", CONTENT_W,
          "Figure 18 — The three sweeps: Missed leads, Proposal check, and "
          "Duplicates."),
    callout_key([
        (1, "<b>Run</b> — each sweep has its own Run button; Missed leads "
            "also has a day-range picker."),
        (2, "<b>Result line</b> — e.g. \"Checked 214 · matched 212 · 2 "
            "gaps.\" Green check = all clear; orange triangle = something "
            "to look at."),
    ]),
    Spacer(1, 4),
    *bullets([
        "<b>Missed leads</b> — same check as the Leads → Missed tab: GHL "
        "leads with no record here. (Import them from that tab.)",
        "<b>Proposal check</b> — compares PaintScout quotes against our "
        "records; flags quotes that are missing or whose won/lost outcome "
        "disagrees. If one shows up, tell Matt or the salesperson — it "
        "usually means someone forgot to update an outcome.",
        "<b>Duplicates</b> — two records accidentally created for the same "
        "lead (an automation race). Pick the row to <b>keep</b> — usually "
        "the one with the proper source and more contacts — and resolve. "
        "The duplicate's history moves to the survivor before the copy is "
        "removed.",
    ]),
    *box("warn", "Resolving duplicates is permanent.",
         "It's the one Reconcile action that changes data. If you're not "
         "sure which record to keep, ask Matt before clicking."),
]

# ============================ 13. DAILY RHYTHM =================================
story += [
    PageBreak(),
    P("13. Your daily rhythm — a checklist", "h1"),
    P("<b>Several times a day</b> (whenever the tab is open):"),
    *bullets([
        "Watch for green <b>New — call now</b> cards. Call within minutes, "
        "not hours — speed-to-lead is the single biggest factor in whether "
        "we book them.",
        "Work the queue top to bottom: callbacks at their time, follow-ups "
        "as they come due.",
        "Log <b>every</b> attempt with the Contacted button, and every "
        "outcome with Book / Callback / Disqualify.",
    ]),
    P("<b>Once a day:</b>"),
    *bullets([
        "Clear the red <b>decide</b> cards — book, disqualify, or abandon.",
        "Open <b>Sources → Fix sources</b> and clear the review list.",
        "Check the <b>Google LSA</b> dashboard (button top-right) for "
        "message-only leads; add any that now have real contact info via "
        "<b>New lead</b>.",
    ]),
    P("<b>Once a week (Monday morning works well):</b>"),
    *bullets([
        "Leads → <b>Missed</b> → Run sweep; import anything it finds.",
        "<b>Reconcile</b> → run all three sweeps; flag Proposal issues to "
        "Matt; resolve obvious duplicates.",
    ]),
    P("The golden rules", "h2"),
    *bullets([
        "All calls and texts happen <b>in GoHighLevel</b> — never from your "
        "personal number.",
        "Email customers only from your <b>@hometownpaintingokc.com</b> "
        "address.",
        "If it isn't logged in the app, it didn't happen.",
        "<b>Delete</b> is for spam only. Real people get Abandon or "
        "Disqualify.",
        "Stuck, or found a bug? This app is young and we're improving it "
        "weekly — tell Matt exactly what you clicked and what you expected. "
        "Your feedback shapes what gets built next.",
    ]),
    Spacer(1, 18),
    Paragraph("Welcome aboard — now go clear that queue.",
              ParagraphStyle("end", parent=styles["body"], fontSize=12,
                             alignment=TA_CENTER, textColor=NAVY)),
]

doc.multiBuild(story)
print("Wrote", OUT)
