import type { Sub } from "@/lib/airtable/types";
import { todayInBusinessTz } from "@/lib/jobs/staging";

/**
 * Subcontractor paperwork compliance, derived from the Insurance Expiration
 * and Worker's Comp Expiration dates on the Crews table. Computed server-side
 * and returned by the subs API so the UI (and a future agent) never reimplements
 * the rules.
 *
 * Status precedence: expired > expiring (within warn window) > missing > ok.
 * Missing dates are surfaced softly — many crews simply haven't had their
 * paperwork entered yet, but "we don't know" is still worth a glance.
 */
export type ComplianceStatus = "ok" | "expiring" | "expired" | "missing";

export type SubCompliance = {
  status: ComplianceStatus;
  /** Short badge text, e.g. "Insurance expired" — null when status is ok. */
  summary: string | null;
  /** One line per problem, for detail views. */
  issues: string[];
};

const WARN_WITHIN_DAYS = 30;

function daysUntil(dateIso: string, todayIso: string): number {
  const d = (s: string) =>
    Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  return Math.round((d(dateIso) - d(todayIso)) / 86_400_000);
}

export function computeCompliance(
  sub: Pick<Sub, "insuranceExpiration" | "workersCompExpiration">,
  opts: { today?: string } = {},
): SubCompliance {
  const today = opts.today ?? todayInBusinessTz();
  const docs = [
    { label: "Insurance", date: sub.insuranceExpiration },
    { label: "Worker's comp", date: sub.workersCompExpiration },
  ];

  const issues: string[] = [];
  let status: ComplianceStatus = "ok";
  let summary: string | null = null;

  const rank: Record<ComplianceStatus, number> = {
    ok: 0,
    missing: 1,
    expiring: 2,
    expired: 3,
  };
  const bump = (next: ComplianceStatus, short: string, detail: string) => {
    issues.push(detail);
    if (rank[next] > rank[status]) {
      status = next;
      summary = short;
    }
  };

  for (const doc of docs) {
    if (!doc.date) {
      bump("missing", `${doc.label} missing`, `${doc.label} expiration not on file`);
      continue;
    }
    const days = daysUntil(doc.date, today);
    if (days < 0) {
      bump("expired", `${doc.label} expired`, `${doc.label} expired ${doc.date}`);
    } else if (days <= WARN_WITHIN_DAYS) {
      bump(
        "expiring",
        `${doc.label} expires in ${days}d`,
        `${doc.label} expires in ${days}d (${doc.date})`,
      );
    }
  }

  return { status, summary, issues };
}

/**
 * " ⚠" suffix for crew names in plain-text contexts (e.g. <option> labels)
 * when the sub's paperwork is expired or about to expire.
 */
export function complianceFlag(c: SubCompliance | undefined): string {
  return c && (c.status === "expired" || c.status === "expiring") ? " ⚠" : "";
}

/** A sub as returned by the subs API: record fields + computed compliance. */
export type SubWithCompliance = Sub & { compliance: SubCompliance };

export function withCompliance(sub: Sub, today?: string): SubWithCompliance {
  return { ...sub, compliance: computeCompliance(sub, { today }) };
}
