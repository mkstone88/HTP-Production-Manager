import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/airtable/errors";
import { LeadsRepo } from "@/lib/airtable/leads";
import { reconcileAuthorized } from "@/lib/reconcile/authorize";
import { reconcileMissed } from "@/lib/reconcile/missed";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/reconcile/backfill?days=7
 *
 * Runs the missed-leads sweep and IMPORTS every gap into Airtable as an Open
 * lead (idempotent by GHL opportunity id), so nothing from GHL is ever left
 * stranded. This is the write counterpart of GET /api/reconcile. Runs nightly
 * via Vercel Cron (Bearer CRON_SECRET) and can also be triggered by an Office
 * Admin. Actor recorded as the session email, or "nightly-cron".
 */
export async function GET(req: Request) {
  if (!(await reconcileAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const days = Number(new URL(req.url).searchParams.get("days") || 7);
  const by = "nightly-cron";
  try {
    const result = await reconcileMissed(Number.isFinite(days) ? days : 7);
    let imported = 0;
    let skipped = 0;
    for (const gap of result.gaps) {
      if (await LeadsRepo.existsByGhlId(gap.ghlId)) {
        skipped++;
        continue;
      }
      await LeadsRepo.importFromGhl(
        {
          ghlOpportunityId: gap.ghlId,
          name: gap.name,
          email: gap.email || undefined,
          phone: gap.phone || undefined,
          source: gap.source || undefined,
          createdAt: gap.createdAt || undefined,
        },
        by,
      );
      imported++;
    }
    return NextResponse.json({
      ranAt: result.ranAt,
      windowDays: result.windowDays,
      ghlChecked: result.ghlChecked,
      gapsFound: result.gaps.length,
      imported,
      skipped,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
