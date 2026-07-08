import { NextResponse } from "next/server";

import { EmailTemplatesRepo } from "@/lib/airtable/email-templates";
import { errorResponse } from "@/lib/airtable/errors";
import { EmailTemplateInput } from "@/lib/airtable/types";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/templates/[id] — edit a template. Admin only. */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    await requireAdmin();
    const { id } = await params;
    const input = EmailTemplateInput.partial().parse(await req.json());
    const template = await EmailTemplatesRepo.update(id, input);
    return NextResponse.json({ template });
  } catch (err) {
    return errorResponse(err);
  }
}

/** DELETE /api/templates/[id] — remove a template type. Admin only. */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    await requireAdmin();
    const { id } = await params;
    await EmailTemplatesRepo.remove(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
