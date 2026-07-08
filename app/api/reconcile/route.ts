import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/airtable/errors";
import { reconcileAuthorized } from "@/lib/reconcile/authorize";
import { reconcileMissed } from "@/lib/reconcile/missed";

export const dynamic = "force-dynamic";
// Sweeps page through GHL; give them room.
export const maxDuration = 60;

/**
 * GET /api/reconcile?days=7 — missed-leads sweep (GHL vs Airtable).
 * Authorized by an Office Admin session or a Bearer CRON_SECRET (Vercel Cron).
 */
export async function GET(req: Request) {
  if (!(await reconcileAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const days = Number(new URL(req.url).searchParams.get("days") || 7);
  try {
    const result = await reconcileMissed(Number.isFinite(days) ? days : 7);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
