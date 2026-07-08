import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/airtable/errors";
import { LeadsRepo } from "@/lib/airtable/leads";
import { getSession, sessionHasRole } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  if (!sessionHasRole(await getSession(), "Office Admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const leads = await LeadsRepo.listRecentlyBooked();
    return NextResponse.json({ leads });
  } catch (err) {
    return errorResponse(err);
  }
}
