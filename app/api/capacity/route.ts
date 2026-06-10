import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/lib/airtable/errors";
import { JobsRepo } from "@/lib/airtable/jobs";
import { SubsRepo } from "@/lib/airtable/subs";
import { todayInBusinessTz } from "@/lib/jobs/staging";
import { computeCapacity } from "@/lib/schedule/capacity";

export const dynamic = "force-dynamic";

const Query = z.object({
  weeks: z.coerce.number().int().min(1).max(16).optional(),
});

/**
 * Booked hours vs. capacity per crew per week, starting this week.
 *
 * Future agent tool: "how far out are we booked?" / "who has room next week?"
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
    const [jobs, subs] = await Promise.all([JobsRepo.list(), SubsRepo.list()]);
    const weeks = computeCapacity(jobs, subs, {
      today: todayInBusinessTz(),
      weeks: params.data.weeks,
    });
    return NextResponse.json({ weeks });
  } catch (err) {
    return errorResponse(err);
  }
}
