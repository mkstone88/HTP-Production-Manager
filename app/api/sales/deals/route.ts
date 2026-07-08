import { NextResponse } from "next/server";

import { DealsRepo } from "@/lib/airtable/deals";
import { errorResponse } from "@/lib/airtable/errors";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/sales/deals — every open (pending) proposal: sent, not yet won or
 * lost. Needs-action deals first (stalest on top), then Waiting ones sorted by
 * their scheduled follow-up.
 */
export async function GET() {
  try {
    await requireRole("Sales");
    const deals = await DealsRepo.listOpen();
    return NextResponse.json({ deals });
  } catch (err) {
    return errorResponse(err);
  }
}
