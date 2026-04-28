import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/lib/airtable/errors";
import { SubsRepo } from "@/lib/airtable/subs";
import { SubStatus } from "@/lib/airtable/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const sub = await SubsRepo.get(id);
    return NextResponse.json({ sub });
  } catch (err) {
    return errorResponse(err);
  }
}

const PatchBody = z.object({
  name: z.string().optional(),
  contactName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  status: SubStatus.nullable().optional(),
  notes: z.string().nullable().optional(),
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
    const sub = await SubsRepo.update(id, body);
    return NextResponse.json({ sub });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    await SubsRepo.delete(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
