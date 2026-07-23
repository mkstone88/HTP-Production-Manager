import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/airtable/errors";
import { MonthString } from "@/lib/airtable/types";
import { marketingReport } from "@/lib/analytics/marketing";
import { getSession, sessionHasRole } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/marketing/roi?from=YYYY-MM&to=YYYY-MM — spend vs cohort outcomes per
 * source, with the keep-spending signal. Range bounds are optional (lead-cohort
 * months, inclusive).
 */
export async function GET(req: Request) {
  if (!sessionHasRole(await getSession(), "Sales")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const url = new URL(req.url);
    const parse = (name: string): string | undefined => {
      const v = url.searchParams.get(name);
      if (!v) return undefined;
      return MonthString.parse(v);
    };
    const report = await marketingReport(parse("from"), parse("to"));
    return NextResponse.json(report);
  } catch (err) {
    return errorResponse(err);
  }
}
