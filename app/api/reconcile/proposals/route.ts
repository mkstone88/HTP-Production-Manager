import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/airtable/errors";
import { reconcileAuthorized } from "@/lib/reconcile/authorize";
import { reconcileProposals } from "@/lib/reconcile/proposals";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/reconcile/proposals — PaintScout quotes vs Airtable outcomes.
 * Authorized by an Office Admin session or a Bearer CRON_SECRET (Vercel Cron).
 */
export async function GET(req: Request) {
  if (!(await reconcileAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await reconcileProposals();
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
