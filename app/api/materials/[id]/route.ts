import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/lib/airtable/errors";
import { MaterialsRepo } from "@/lib/airtable/materials";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * Assign or edit an invoice. `projectId: null` unassigns it; a string assigns it
 * to that Job. Other fields follow the same omit/null/value semantics as jobs.
 */
const PatchBody = z.object({
  vendor: z.string().nullable().optional(),
  invoiceDate: DateOnly.nullable().optional(),
  invoiceNumber: z.string().nullable().optional(),
  po: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  invoiceTotal: z.number().nullable().optional(),
  gallons: z.number().nullable().optional(),
  totalSupplies: z.number().nullable().optional(),
  totalPaint: z.number().nullable().optional(),
});

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  let body: z.infer<typeof PatchBody>;
  try {
    body = PatchBody.parse(await req.json());
  } catch (err) {
    return errorResponse(err);
  }
  try {
    const invoice = await MaterialsRepo.update(id, body);
    return NextResponse.json({ invoice });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    await MaterialsRepo.delete(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
