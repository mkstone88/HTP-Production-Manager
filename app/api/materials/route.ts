import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/lib/airtable/errors";
import { MaterialsRepo } from "@/lib/airtable/materials";
import { AirtableRecordId } from "@/lib/airtable/types";
import { requireActiveUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const Query = z.object({
  unassigned: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === "true"),
  projectId: z.string().optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const params = Query.safeParse(Object.fromEntries(url.searchParams));
  if (!params.success) {
    return NextResponse.json(
      { error: "Bad query", issues: params.error.issues },
      { status: 400 },
    );
  }
  try {
    const invoices = await MaterialsRepo.list(params.data);
    return NextResponse.json({ invoices });
  } catch (err) {
    return errorResponse(err);
  }
}

const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const CreateBody = z.object({
  vendor: z.string().optional(),
  invoiceDate: DateOnly.optional(),
  invoiceNumber: z.string().optional(),
  po: z.string().optional(),
  projectId: AirtableRecordId.optional(),
  invoiceTotal: z.number().nonnegative().optional(),
  gallons: z.number().nonnegative().optional(),
  totalSupplies: z.number().nonnegative().optional(),
  totalPaint: z.number().nonnegative().optional(),
});

export async function POST(req: Request) {
  let body: z.infer<typeof CreateBody>;
  try {
    body = CreateBody.parse(await req.json());
  } catch (err) {
    return errorResponse(err);
  }
  try {
    await requireActiveUser();
    const invoice = await MaterialsRepo.create(body);
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
