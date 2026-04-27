import { NextResponse } from "next/server";
import { z } from "zod";

import { AirtableError } from "@/lib/airtable/client";
import { SubsRepo } from "@/lib/airtable/subs";

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
    return NextResponse.json({ error: "Bad query" }, { status: 400 });
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
  email: z.string().optional(),
  trade: z.string().optional(),
  active: z.boolean().optional(),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  let body: z.infer<typeof CreateBody>;
  try {
    body = CreateBody.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
  }
  try {
    const sub = await SubsRepo.create(body);
    return NextResponse.json({ sub }, { status: 201 });
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
