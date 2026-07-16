import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/airtable/errors";
import { MarketingSpendRepo } from "@/lib/airtable/marketing-spend";
import { MarketingSpendMonthInput } from "@/lib/airtable/types";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/marketing/spend/month — the month-end form. Upserts every listed
 * source's amount for the month in one submit; unlisted sources are untouched.
 * Reopen the same month to correct it — updates, never duplicates.
 */
export async function POST(req: Request) {
  try {
    await requireRole("Sales");
    const input = MarketingSpendMonthInput.parse(await req.json());
    const rows = await MarketingSpendRepo.upsertMonth(input);
    return NextResponse.json({ rows });
  } catch (err) {
    return errorResponse(err);
  }
}
