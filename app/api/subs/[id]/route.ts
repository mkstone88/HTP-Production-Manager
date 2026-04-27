import { NextResponse } from "next/server";
import { z } from "zod";

import { AirtableError } from "@/lib/airtable/client";
import { SubsRepo } from "@/lib/airtable/subs";

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
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  trade: z.string().optional(),
  active: z.boolean().optional(),
  notes: z.string().optional(),
});

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  let body: z.infer<typeof PatchBody>;
  try {
    body = PatchBody.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
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

function errorResponse(err: unknown) {
  if (err instanceof AirtableError) {
    return NextResponse.json(
      { error: err.message, type: err.type },
      { status: err.status },
    );
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  return NextResponse.json({ error: message }, { status: 500 });
}
