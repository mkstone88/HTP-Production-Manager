import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/lib/airtable/errors";
import { JobsRepo } from "@/lib/airtable/jobs";
import { JobStatus, ProjectType } from "@/lib/airtable/types";

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

/**
 * Field-by-field semantics:
 *  - Omitted key: leave field untouched.
 *  - `null`: clear the field on Airtable.
 *  - String value: set the field.
 *
 * `name`, `customerName`, `address` are NOT patchable — they're formula/lookup fields.
 */
const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const PatchBody = z.object({
  jobNumber: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  status: JobStatus.nullable().optional(),
  projectType: ProjectType.nullable().optional(),
  scheduledStart: DateOnly.nullable().optional(),
  scheduledEnd: DateOnly.nullable().optional(),
  assignedSubId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  emailSent: z.boolean().optional(),
  customerReplied: z.boolean().optional(),
  colorsReceived: z.boolean().optional(),
  workOrderReady: z.boolean().optional(),
  projectAmount: z.number().nullable().optional(),
  subPayout: z.number().nullable().optional(),
  jobCostingComplete: z.boolean().optional(),
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
    const job = await JobsRepo.update(id, body);
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
