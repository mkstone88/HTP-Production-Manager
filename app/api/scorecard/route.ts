import { NextResponse } from "next/server";
import { z } from "zod";

import { weeklyScorecard } from "@/lib/analytics/scorecard";
import { errorResponse } from "@/lib/airtable/errors";
import { requireSessionRole } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Query = z.object({
  weeks: z.coerce.number().int().min(1).max(104).optional(),
});

/**
 * GET /api/scorecard?weeks=26
 * Week-of-activity scorecard (Mon–Sun, Central). Returns { rows: WeekRow[] }.
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
    await requireSessionRole("Sales");
    const rows = await weeklyScorecard(params.data.weeks ?? 26);
    return NextResponse.json({ rows });
  } catch (err) {
    return errorResponse(err);
  }
}
