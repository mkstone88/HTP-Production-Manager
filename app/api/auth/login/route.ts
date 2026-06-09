import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/lib/airtable/errors";
import { UsersRepo } from "@/lib/airtable/users";
import { SESSION_COOKIE, issueSession, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Per-IP brute-force throttle. In-memory, so it resets on redeploy and only
 * covers a single instance — adequate for this app's one-server deployment.
 */
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS_PER_WINDOW = 8;
const attempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  if (attempts.size > 1000) {
    for (const [k, v] of attempts) {
      if (now > v.resetAt) attempts.delete(k);
    }
  }
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS_PER_WINDOW;
}

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a minute." },
      { status: 429 },
    );
  }

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Enter your email and password." },
      { status: 400 },
    );
  }

  try {
    const found = await UsersRepo.findByEmailWithSecret(parsed.email);
    const ok =
      !!found &&
      found.user.active &&
      (await verifyPassword(parsed.password, found.passwordHash));
    if (!found || !ok) {
      // Same message whether the email is unknown, the password is wrong, or
      // the account is disabled — don't reveal which.
      return NextResponse.json(
        { error: "Incorrect email or password." },
        { status: 401 },
      );
    }

    const { token, expiresAt } = await issueSession({
      uid: found.user.id,
      role: found.user.role,
    });
    const res = NextResponse.json({ ok: true, user: found.user });
    res.cookies.set({
      name: SESSION_COOKIE,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
