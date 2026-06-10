import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/lib/airtable/errors";
import { SubsRepo } from "@/lib/airtable/subs";
import {
  AirtableRecordId,
  DateOnly,
  HexColor,
  SubStatus,
} from "@/lib/airtable/types";
import { requireActiveUser } from "@/lib/session";
import { withCompliance } from "@/lib/subs/compliance";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function invalidId() {
  return NextResponse.json({ error: "Invalid record id" }, { status: 400 });
}

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!AirtableRecordId.safeParse(id).success) return invalidId();
  try {
    const sub = await SubsRepo.get(id);
    return NextResponse.json({ sub: withCompliance(sub) });
  } catch (err) {
    return errorResponse(err);
  }
}

const PatchBody = z.object({
  // Company Name is the Airtable primary field — never let a PATCH blank it.
  name: z.string().min(1).optional(),
  contactName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
  status: SubStatus.nullable().optional(),
  color: HexColor.nullable().optional(),
  notes: z.string().nullable().optional(),
  insuranceExpiration: DateOnly.nullable().optional(),
  workersCompExpiration: DateOnly.nullable().optional(),
  weeklyCapacityHours: z.number().int().positive().max(200).nullable().optional(),
});

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!AirtableRecordId.safeParse(id).success) return invalidId();
  let body: z.infer<typeof PatchBody>;
  try {
    body = PatchBody.parse(await req.json());
  } catch (err) {
    return errorResponse(err);
  }
  try {
    await requireActiveUser();
    const sub = await SubsRepo.update(id, body);
    return NextResponse.json({ sub: withCompliance(sub) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!AirtableRecordId.safeParse(id).success) return invalidId();
  try {
    await requireActiveUser();
    await SubsRepo.delete(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
