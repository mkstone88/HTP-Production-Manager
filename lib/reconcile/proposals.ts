// Proposal sweep: compare PaintScout quotes against Airtable so no proposal
// (especially a WIN) goes unrecorded or mislabeled. Read-only — reports gaps and
// mismatches; fixing is a human decision.
import "server-only";

import { OpportunitiesRepo } from "@/lib/airtable/opportunities";
import type { ProposalIssue, ProposalReport } from "@/lib/airtable/types";
import { listAllQuotes } from "@/lib/paintscout";

/** PS status → the Airtable Sale Outcome it should correspond to (null = any). */
function expectedOutcome(ps: string): string | null {
  if (ps === "accepted") return "Won";
  if (ps === "declined") return "Lost";
  return null; // sent/viewed/onHold can be Pending/blank/Lost(stale) — don't flag
}

export async function reconcileProposals(): Promise<ProposalReport> {
  const [quotes, opps] = await Promise.all([
    listAllQuotes(),
    OpportunitiesRepo.list(),
  ]);

  const byQid = new Map<string, (typeof opps)[number]>();
  const emails = new Set<string>();
  for (const o of opps) {
    const qid = (o.paintScoutQuoteId ?? "").trim();
    if (qid) byQid.set(qid, o);
    const em = (o.matchEmail ?? "").trim().toLowerCase();
    if (em) emails.add(em);
  }

  const issues: ProposalIssue[] = [];
  let matched = 0;
  // Drafts are not deliverables; ignore them.
  const real = quotes.filter((q) => q.status !== "draft");

  for (const q of real) {
    const opp = byQid.get(q.id);
    if (opp) {
      matched++;
      const expect = expectedOutcome(q.status);
      const actual = opp.saleOutcome || null;
      if (expect && actual !== expect) {
        issues.push({
          kind: "outcome-mismatch",
          quoteNumber: q.number,
          name: q.name,
          email: q.email,
          psStatus: q.status,
          airtableOutcome: actual,
          total: q.total,
          sentDate: q.sentDate,
          detail: `PaintScout says ${q.status}, Airtable says ${actual || "(none)"}`,
        });
      }
      continue;
    }
    // No quote-id match. An email match means the lead exists but this quote
    // isn't attached (multi-proposal or in-home acceptance) — only alarm when the
    // quote is decided; open sent/viewed quotes attach when acted on.
    const known = Boolean(q.email) && emails.has(q.email);
    const decided = q.status === "accepted" || q.status === "declined";
    if (!known || decided) {
      issues.push({
        kind: "missing",
        quoteNumber: q.number,
        name: q.name,
        email: q.email,
        psStatus: q.status,
        airtableOutcome: null,
        total: q.total,
        sentDate: q.sentDate,
        detail: known
          ? "Decided quote not attached to any opportunity (contact exists)"
          : "No opportunity found by quote id or email",
      });
    } else {
      matched++; // open quote on a known lead — fine for now
    }
  }

  // Wins first, then by value — most important issues on top.
  issues.sort(
    (a, b) =>
      Number(b.psStatus === "accepted") - Number(a.psStatus === "accepted") ||
      b.total - a.total,
  );

  return {
    ranAt: new Date().toISOString(),
    quotesChecked: real.length,
    matched,
    issues,
  };
}
