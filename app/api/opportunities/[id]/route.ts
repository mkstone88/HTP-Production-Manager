import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/lib/airtable/errors";
import { SourcesRepo } from "@/lib/airtable/sources";
import { LeadSource } from "@/lib/airtable/types";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  action: z.literal("setSource"),
  source: LeadSource,
  remember: z.boolean().default(false),
});

/**
 * PATCH /api/opportunities/[id] — correct a lead's Source. With remember=true,
 * saves the raw→canonical alias and applies it to every other unresolved lead
 * sharing that raw value.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await requireRole("Office Admin", "Sales");
    const { id } = await params;
    const body = Body.parse(await req.json());
    const result = await SourcesRepo.setSource(
      id,
      body.source,
      body.remember,
      user.email,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return errorResponse(err);
  }
}
