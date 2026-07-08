import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/airtable/errors";
import { LeadsRepo } from "@/lib/airtable/leads";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/leads/search?q=… — find leads across ALL setter statuses by name,
 * email, or phone. Lets the setter pull up a historical lead (booked, DQ'd,
 * abandoned…) to correct it or bring it back into the queue.
 */
export async function GET(req: Request) {
  try {
    await requireRole("Office Admin");
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) {
      return NextResponse.json({ error: "Search needs at least 2 characters." }, { status: 400 });
    }
    const leads = await LeadsRepo.search(q);
    return NextResponse.json({ leads });
  } catch (err) {
    return errorResponse(err);
  }
}
