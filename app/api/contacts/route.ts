import { NextResponse } from "next/server";
import { z } from "zod";

import { ContactsRepo } from "@/lib/airtable/contacts";
import { errorResponse } from "@/lib/airtable/errors";
import { requireRole, requireSessionRole } from "@/lib/session";

export const dynamic = "force-dynamic";

const Query = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
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
    await requireSessionRole("Production Manager");
    const contacts = await ContactsRepo.list(params.data);
    return NextResponse.json({ contacts });
  } catch (err) {
    return errorResponse(err);
  }
}

const CreateBody = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
});

export async function POST(req: Request) {
  let body: z.infer<typeof CreateBody>;
  try {
    await requireRole("Production Manager");
    body = CreateBody.parse(await req.json());
  } catch (err) {
    return errorResponse(err);
  }
  try {
    const contact = await ContactsRepo.create({
      ...body,
      email: body.email || undefined,
    });
    return NextResponse.json({ contact }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
