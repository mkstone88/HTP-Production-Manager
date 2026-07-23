import { NextResponse } from "next/server";
import { z } from "zod";

import { ContactsRepo } from "@/lib/airtable/contacts";
import { errorResponse } from "@/lib/airtable/errors";
import { JobsRepo } from "@/lib/airtable/jobs";
import { JobStatus, ProjectType } from "@/lib/airtable/types";
import { requireRole, requireSessionRole } from "@/lib/session";

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
    return NextResponse.json(
      { error: "Bad query", issues: params.error.issues },
      { status: 400 },
    );
  }
  try {
    await requireSessionRole("Production Manager");
    const jobs = await JobsRepo.list(params.data);
    return NextResponse.json({ jobs });
  } catch (err) {
    return errorResponse(err);
  }
}

const NewContact = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
});

const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const CreateBody = z
  .object({
    jobNumber: z.string().min(1),
    projectType: ProjectType,
    status: JobStatus.optional(),
    scheduledStart: DateOnly.optional(),
    scheduledEnd: DateOnly.optional(),
    assignedSubId: z.string().optional(),
    notes: z.string().optional(),
    // Either pick an existing contact...
    customerId: z.string().optional(),
    // ...or create a new one inline.
    newContact: NewContact.optional(),
  })
  .refine(
    (b) => Boolean(b.customerId) !== Boolean(b.newContact),
    { message: "Provide exactly one of customerId or newContact" },
  );

export async function POST(req: Request) {
  let body: z.infer<typeof CreateBody>;
  try {
    await requireRole("Production Manager");
    body = CreateBody.parse(await req.json());
  } catch (err) {
    return errorResponse(err);
  }
  try {
    let customerId = body.customerId;
    if (!customerId && body.newContact) {
      const contact = await ContactsRepo.create({
        firstName: body.newContact.firstName,
        lastName: body.newContact.lastName,
        email: body.newContact.email || undefined,
        phone: body.newContact.phone,
        street: body.newContact.street,
        city: body.newContact.city,
        state: body.newContact.state,
        zip: body.newContact.zip,
      });
      customerId = contact.id;
    }
    if (!customerId) {
      return NextResponse.json({ error: "No customer" }, { status: 400 });
    }
    const job = await JobsRepo.create({
      jobNumber: body.jobNumber,
      customerId,
      projectType: body.projectType,
      status: body.status,
      scheduledStart: body.scheduledStart,
      scheduledEnd: body.scheduledEnd,
      assignedSubId: body.assignedSubId,
      notes: body.notes,
    });
    return NextResponse.json({ job }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
