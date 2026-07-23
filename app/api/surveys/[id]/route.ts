import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/airtable/errors";
import { SurveysRepo } from "@/lib/airtable/surveys";
import { SurveyPatch } from "@/lib/airtable/types";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/surveys/[id] — one survey, flattened. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    await requireRole("Sales");
    const { id } = await params;
    const survey = await SurveysRepo.get(id);
    return NextResponse.json({ survey });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * PATCH /api/surveys/[id] — autosave. Send only changed answers; null clears.
 * Setting nextFollowUpAt also mirrors to the deal's Sales Follow-Up At.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await requireRole("Sales");
    const { id } = await params;
    const patch = SurveyPatch.parse(await req.json());
    const survey = await SurveysRepo.patch(id, patch, user.email);
    return NextResponse.json({ survey });
  } catch (err) {
    return errorResponse(err);
  }
}
