import { NextResponse } from "next/server";

import { listSalesRows } from "@/lib/analytics/sales";
import { errorResponse } from "@/lib/airtable/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/analytics/sales
 * Every proposal sent, with its outcome, for the sales dashboard. Win-rate math
 * is documented in lib/analytics/sales.ts. Returns { rows: SalesRow[] }.
 */
export async function GET() {
  try {
    const rows = await listSalesRows();
    return NextResponse.json({ rows });
  } catch (err) {
    return errorResponse(err);
  }
}
