import { NextResponse } from "next/server";
import { z } from "zod";

import { AirtableError } from "@/lib/airtable/client";
import { JobsRepo } from "@/lib/airtable/jobs";

export const dynamic = "force-dynamic";

const Query = z.object({
  subId: z.string().optional(),
  unscheduled: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === "true"),
  unassigned: z
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
    const jobs = await JobsRepo.list(params.data);
    return NextResponse.json({ jobs });
  } catch (err) {
    return errorResponse(err);
  }
}

const CreateBody = z.object({
  name: z.string().min(1),
  client: z.string().optional(),
  address: z.string().optional(),
  status: z.string().optional(),
  scheduledStart: z.string().optional(),
  scheduledEnd: z.string().optional(),
  assignedSubId: z.string().optional(),
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
    const job = await JobsRepo.create(body);
    return NextResponse.json({ job }, { status: 201 });
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
