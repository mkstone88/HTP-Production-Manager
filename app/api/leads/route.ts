import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/lib/airtable/errors";
import { LeadsRepo } from "@/lib/airtable/leads";
import { LeadSource, OppJobType } from "@/lib/airtable/types";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

const CreateBody = z.object({
  firstName: z.string().default(""),
  lastName: z.string().default(""),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  source: LeadSource,
  jobType: OppJobType.optional(),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireRole("Office Admin");
    const body = CreateBody.parse(await req.json());
    if (!body.firstName && !body.lastName && !body.email && !body.phone) {
      return NextResponse.json(
        { error: "Provide at least a name, email, or phone" },
        { status: 400 },
      );
    }
    const lead = await LeadsRepo.create(
      { ...body, email: body.email || undefined },
      user.email,
    );
    return NextResponse.json({ lead }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
