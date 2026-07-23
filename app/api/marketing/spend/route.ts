import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/airtable/errors";
import { MarketingSpendRepo } from "@/lib/airtable/marketing-spend";
import { MarketingSpendInput } from "@/lib/airtable/types";
import { getSession, requireRole, sessionHasRole } from "@/lib/session";

export const dynamic = "force-dynamic";

/** GET /api/marketing/spend — every source × month spend row. */
export async function GET() {
  if (!sessionHasRole(await getSession(), "Sales")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const rows = await MarketingSpendRepo.list();
    return NextResponse.json({ rows });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * POST /api/marketing/spend — record a month's spend for a source. Upserts by
 * (source, month): logging the same cell twice corrects it, never duplicates.
 */
export async function POST(req: Request) {
  try {
    await requireRole("Sales");
    const input = MarketingSpendInput.parse(await req.json());
    const row = await MarketingSpendRepo.upsert(input);
    return NextResponse.json({ row });
  } catch (err) {
    return errorResponse(err);
  }
}
