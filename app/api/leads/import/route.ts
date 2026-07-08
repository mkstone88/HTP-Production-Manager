import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/lib/airtable/errors";
import { LeadsRepo } from "@/lib/airtable/leads";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Shape of a missed-leads gap (from GET /api/reconcile). */
const ImportBody = z.object({
  ghlId: z.string().min(1),
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  source: z.string().optional(),
  createdAt: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireRole("Office Admin");
    const body = ImportBody.parse(await req.json());
    if (await LeadsRepo.existsByGhlId(body.ghlId)) {
      return NextResponse.json({ skipped: true, reason: "already-imported" });
    }
    const lead = await LeadsRepo.importFromGhl(
      {
        ghlOpportunityId: body.ghlId,
        name: body.name || "",
        email: body.email,
        phone: body.phone,
        source: body.source,
        createdAt: body.createdAt,
      },
      user.email,
    );
    return NextResponse.json({ lead }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
