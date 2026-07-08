import { NextResponse } from "next/server";

import { EmailTemplatesRepo } from "@/lib/airtable/email-templates";
import { errorResponse } from "@/lib/airtable/errors";
import { EmailTemplateInput } from "@/lib/airtable/types";
import { requireAdmin, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** GET /api/templates — all email templates. Any signed-in user (triage reads them). */
export async function GET() {
  try {
    await requireUser();
    const templates = await EmailTemplatesRepo.list();
    return NextResponse.json({ templates });
  } catch (err) {
    return errorResponse(err);
  }
}

/** POST /api/templates — add a template type. Admin only (Settings screen). */
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const input = EmailTemplateInput.parse(await req.json());
    const template = await EmailTemplatesRepo.create(input);
    return NextResponse.json({ template }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
