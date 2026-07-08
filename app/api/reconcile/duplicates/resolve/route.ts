import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/lib/airtable/errors";
import { reconcileAuthorized } from "@/lib/reconcile/authorize";
import {
  resolveContactDuplicates,
  resolveOpportunityDuplicates,
} from "@/lib/reconcile/resolve";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  type: z.enum(["opportunity", "contact"]),
  keepId: z.string().min(1),
  removeIds: z.array(z.string().min(1)).min(1),
});

/**
 * POST /api/reconcile/duplicates/resolve
 * Keep one record of a duplicate group, remove the rest. For contacts, the
 * removed contacts' opportunities are re-linked to the survivor first.
 * Office Admin / Admin only (session; not the cron path).
 */
export async function POST(req: Request) {
  if (!(await reconcileAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return errorResponse(err);
  }
  if (body.removeIds.includes(body.keepId)) {
    return NextResponse.json(
      { error: "keepId cannot also be in removeIds" },
      { status: 400 },
    );
  }
  try {
    const result =
      body.type === "contact"
        ? await resolveContactDuplicates(body.keepId, body.removeIds)
        : await resolveOpportunityDuplicates(body.keepId, body.removeIds);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return errorResponse(err);
  }
}
