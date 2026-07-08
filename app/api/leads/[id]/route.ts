import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/lib/airtable/errors";
import { LeadsRepo } from "@/lib/airtable/leads";
import { DisqualifyReason } from "@/lib/airtable/types";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const ActionBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("contacted") }),
  z.object({ action: z.literal("book"), appointmentAt: z.string().optional() }),
  z.object({ action: z.literal("disqualify"), reason: DisqualifyReason }),
  z.object({ action: z.literal("abandon") }),
  z.object({ action: z.literal("reschedule") }),
  z.object({ action: z.literal("reopen") }),
]);

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await requireRole("Office Admin");
    const { id } = await params;
    const by = user.email;
    const body = ActionBody.parse(await req.json());
    let lead;
    switch (body.action) {
      case "contacted":
        lead = await LeadsRepo.markContacted(id, by);
        break;
      case "book":
        lead = await LeadsRepo.book(id, by, body.appointmentAt);
        break;
      case "disqualify":
        lead = await LeadsRepo.disqualify(id, body.reason, by);
        break;
      case "abandon":
        lead = await LeadsRepo.abandon(id, by);
        break;
      case "reschedule":
        lead = await LeadsRepo.reschedule(id, by);
        break;
      case "reopen":
        lead = await LeadsRepo.reopen(id, by);
        break;
    }
    return NextResponse.json({ lead });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    await requireRole("Office Admin");
    const { id } = await params;
    await LeadsRepo.remove(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
