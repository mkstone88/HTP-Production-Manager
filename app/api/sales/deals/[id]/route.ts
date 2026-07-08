import { NextResponse } from "next/server";
import { z } from "zod";

import { DealsRepo } from "@/lib/airtable/deals";
import { errorResponse } from "@/lib/airtable/errors";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const ActionBody = z.discriminatedUnion("action", [
  // Schedule the next check-in; null clears it (deal returns to "follow up").
  z.object({ action: z.literal("setFollowUp"), followUpAt: z.string().nullable() }),
  z.object({ action: z.literal("note"), note: z.string().min(1).max(2000) }),
  // Close from the board. Won defaults to the sent proposal amount.
  z.object({ action: z.literal("markWon"), amount: z.number().positive().optional() }),
  z.object({ action: z.literal("markLost"), reason: z.string().min(1).max(500) }),
]);

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await requireRole("Sales");
    const { id } = await params;
    const body = ActionBody.parse(await req.json());
    let deal;
    switch (body.action) {
      case "setFollowUp":
        deal = await DealsRepo.setFollowUp(id, user.email, body.followUpAt);
        break;
      case "note":
        deal = await DealsRepo.addNote(id, user.email, body.note);
        break;
      case "markWon":
        deal = await DealsRepo.markWon(id, user.email, body.amount);
        break;
      case "markLost":
        deal = await DealsRepo.markLost(id, user.email, body.reason);
        break;
    }
    return NextResponse.json({ deal });
  } catch (err) {
    return errorResponse(err);
  }
}
