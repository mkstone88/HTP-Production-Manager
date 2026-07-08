import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/airtable/errors";
import { reconcileAuthorized } from "@/lib/reconcile/authorize";
import { findDuplicates } from "@/lib/reconcile/duplicates";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/reconcile/duplicates — records sharing a GHL id (data integrity).
 * Authorized by an Office Admin session or a Bearer CRON_SECRET (Vercel Cron).
 */
export async function GET(req: Request) {
  if (!(await reconcileAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await findDuplicates();
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
