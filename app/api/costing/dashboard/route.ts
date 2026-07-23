import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/lib/airtable/errors";
import { JobsRepo } from "@/lib/airtable/jobs";
import { MaterialsRepo } from "@/lib/airtable/materials";
import { computeKpis, filterByCompletionDate } from "@/lib/costing/dashboard";
import { requireSessionRole } from "@/lib/session";

export const dynamic = "force-dynamic";

const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const Query = z.object({
  from: DateOnly.optional(),
  to: DateOnly.optional(),
});

/**
 * Central job-costing hub data:
 *  - `needsFinalizing`: Completed jobs whose costing isn't done (the worklist).
 *  - `costed`: finalized jobs whose completion date is inside [from, to],
 *    newest first, plus `kpis` computed over that same set.
 *  - `unassignedInvoiceCount`: drives the "assign invoices first" warning.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const params = Query.safeParse(Object.fromEntries(url.searchParams));
  if (!params.success) {
    return NextResponse.json(
      { error: "Bad query", issues: params.error.issues },
      { status: 400 },
    );
  }
  try {
    await requireSessionRole("Production Manager");
    const { from, to } = params.data;
    const [allJobs, unassignedInvoiceCount] = await Promise.all([
      JobsRepo.list(),
      MaterialsRepo.unassignedCount(),
    ]);

    const needsFinalizing = allJobs
      .filter((j) => j.status === "Completed" && !j.jobCostingComplete)
      .sort((a, b) => (b.scheduledEnd ?? "").localeCompare(a.scheduledEnd ?? ""));

    const costed = filterByCompletionDate(
      allJobs.filter((j) => j.jobCostingComplete),
      from,
      to,
    ).sort((a, b) => (b.scheduledEnd ?? "").localeCompare(a.scheduledEnd ?? ""));

    return NextResponse.json({
      kpis: computeKpis(costed),
      needsFinalizing,
      costed,
      unassignedInvoiceCount,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
