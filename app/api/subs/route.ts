import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/lib/airtable/errors";
import { SubsRepo } from "@/lib/airtable/subs";
import { HexColor, SubStatus } from "@/lib/airtable/types";
import { requireActiveUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const Query = z.object({
  activeOnly: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === "true"),
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
    const subs = await SubsRepo.list(params.data);
    return NextResponse.json({ subs });
  } catch (err) {
    return errorResponse(err);
  }
}

const CreateBody = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  status: SubStatus.optional(),
  color: HexColor.optional(),
  notes: z.string().optional(),
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
    const sub = await SubsRepo.create(body);
    return NextResponse.json({ sub }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
