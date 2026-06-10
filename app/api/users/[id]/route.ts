import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/lib/airtable/errors";
import { UsersRepo } from "@/lib/airtable/users";
import { UserRole, type AppUser } from "@/lib/airtable/types";
import { hashPassword } from "@/lib/auth";
import { invalidateUserCache, requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Guard against locking everyone out by removing the only active admin. */
function isLastActiveAdmin(users: AppUser[], targetId: string): boolean {
  const activeAdmins = users.filter((u) => u.role === "admin" && u.active);
  return activeAdmins.length === 1 && activeAdmins[0].id === targetId;
}

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    await requireAdmin();
    const user = await UsersRepo.get(id);
    return NextResponse.json({ user });
  } catch (err) {
    return errorResponse(err);
  }
}

const PatchBody = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: UserRole.optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    await requireAdmin();
    const body = PatchBody.parse(await req.json());
    const target = await UsersRepo.get(id);

    if (body.email && body.email.toLowerCase() !== target.email.toLowerCase()) {
      const existing = await UsersRepo.findByEmailWithSecret(body.email);
      if (existing) {
        return NextResponse.json(
          { error: "A user with that email already exists." },
          { status: 409 },
        );
      }
    }

    // Block demoting/deactivating the last active admin.
    const stillActiveAdmin =
      (body.role ?? target.role) === "admin" && (body.active ?? target.active);
    if (!stillActiveAdmin) {
      const users = await UsersRepo.list();
      if (isLastActiveAdmin(users, id)) {
        return NextResponse.json(
          { error: "You can't remove the last active admin." },
          { status: 409 },
        );
      }
    }

    const user = await UsersRepo.update(id, {
      name: body.name,
      email: body.email?.toLowerCase(),
      role: body.role,
      active: body.active,
      passwordHash: body.password ? await hashPassword(body.password) : undefined,
    });
    invalidateUserCache(id);
    return NextResponse.json({ user });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const admin = await requireAdmin();
    if (admin.id === id) {
      return NextResponse.json(
        { error: "You can't delete your own account." },
        { status: 409 },
      );
    }
    const users = await UsersRepo.list();
    if (isLastActiveAdmin(users, id)) {
      return NextResponse.json(
        { error: "You can't delete the last active admin." },
        { status: 409 },
      );
    }
    await UsersRepo.delete(id);
    invalidateUserCache(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
