import { NextResponse } from "next/server";
import { z } from "zod";

import { AirtableError } from "@/lib/airtable/client";
import { JobsRepo } from "@/lib/airtable/jobs";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const job = await JobsRepo.get(id);
    return NextResponse.json({ job });
  } catch (err) {
    return errorResponse(err);
  }
}

const PatchBody = z.object({
  name: z.string().optional(),
  client: z.string().optional(),
  address: z.string().optional(),
  status: z.string().optional(),
  scheduledStart: z.string().nullable().optional(),
  scheduledEnd: z.string().nullable().optional(),
  assignedSubId: z.string().nullable().optional(),
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
  // Convert nulls to "" so Airtable clears the field.
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    patch[k] = v === null ? "" : v;
  }
  try {
    const job = await JobsRepo.update(id, patch);
    return NextResponse.json({ job });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    await JobsRepo.delete(id);
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
