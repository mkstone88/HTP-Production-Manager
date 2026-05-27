import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/lib/airtable/errors";
import { UsersRepo } from "@/lib/airtable/users";
import { UserRole } from "@/lib/airtable/types";
import { hashPassword } from "@/lib/auth";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const users = await UsersRepo.list();
    return NextResponse.json({ users });
  } catch (err) {
    return errorResponse(err);
  }
}

const CreateBody = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: UserRole,
  password: z.string().min(8),
  active: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = CreateBody.parse(await req.json());

    const existing = await UsersRepo.findByEmailWithSecret(body.email);
    if (existing) {
      return NextResponse.json(
        { error: "A user with that email already exists." },
        { status: 409 },
      );
    }

    const user = await UsersRepo.create({
      name: body.name,
      email: body.email.toLowerCase(),
      role: body.role,
      active: body.active ?? true,
      passwordHash: await hashPassword(body.password),
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
