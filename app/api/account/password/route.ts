import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/lib/airtable/errors";
import { UsersRepo } from "@/lib/airtable/users";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const Body = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

/** Self-service password change. Any signed-in user can change their own. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = Body.parse(await req.json());

    const { passwordHash } = await UsersRepo.getWithSecret(user.id);
    const ok = await verifyPassword(body.currentPassword, passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: "Your current password is incorrect." },
        { status: 403 },
      );
    }

    await UsersRepo.update(user.id, {
      passwordHash: await hashPassword(body.newPassword),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
