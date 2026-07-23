import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/airtable/errors";
import { SurveysRepo } from "@/lib/airtable/surveys";
import { CreateSurveyInput } from "@/lib/airtable/types";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/surveys — appointments to survey.
 * Without ?q: the "up next" list — the six appointments closest to now
 * (yesterday onward) that don't have a survey yet.
 * With ?q: search every opportunity by contact name (includes already-surveyed,
 * flagged via surveyId, so tapping one resumes instead of duplicating).
 */
export async function GET(req: Request) {
  try {
    await requireRole("Sales");
    const q = new URL(req.url).searchParams.get("q") ?? undefined;
    const rows = await SurveysRepo.candidates(q || undefined);
    return NextResponse.json({ rows });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * POST /api/surveys — start (or resume) the survey for an opportunity.
 * Idempotent: one survey per appointment, always returned with its id so the
 * client can navigate straight to the form.
 */
export async function POST(req: Request) {
  try {
    const user = await requireRole("Sales");
    const input = CreateSurveyInput.parse(await req.json());
    const survey = await SurveysRepo.findOrCreate(input.opportunityId, user.email);
    return NextResponse.json({ survey });
  } catch (err) {
    return errorResponse(err);
  }
}
