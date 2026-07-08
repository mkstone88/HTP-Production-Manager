import { NextResponse } from "next/server";

import { listFunnelRows } from "@/lib/analytics/funnel";
import { errorResponse } from "@/lib/airtable/errors";
import { getSession, sessionHasRole } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  if (!sessionHasRole(await getSession(), "Office Admin", "Sales")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const rows = await listFunnelRows();
    return NextResponse.json({ rows });
  } catch (err) {
    return errorResponse(err);
  }
}
