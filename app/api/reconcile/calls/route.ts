import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/airtable/errors";
import { reconcileAuthorized } from "@/lib/reconcile/authorize";
import { syncCalls } from "@/lib/reconcile/call-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/reconcile/calls — the call-sync sweep. Finds outbound GHL calls on
 * queue leads with no logged touch and logs them (attempt counter, cadence,
 * audit "call-sync"), anchored at the actual call time. Idempotent: a synced
 * call becomes the lead's last touch, so the next run skips it. Runs hourly
 * via Vercel Cron (Bearer CRON_SECRET); an Office Admin can trigger it too.
 */
export async function GET(req: Request) {
  if (!(await reconcileAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await syncCalls();
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
