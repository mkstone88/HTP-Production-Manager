import "server-only";

import { cookies } from "next/headers";

import { UsersRepo } from "@/lib/airtable/users";
import { AuthError } from "@/lib/airtable/errors";
import type { AppUser } from "@/lib/airtable/types";
import { SESSION_COOKIE, verifySession, type Session } from "@/lib/auth";

/**
 * Server-side session helpers for route handlers and server components.
 *
 * `getSession` is cheap (just verifies the signed cookie) and is enough for
 * read access — the middleware (proxy.ts) has already gated unauthenticated
 * requests. `getCurrentUser` additionally re-reads the user from Airtable so a
 * just-demoted or deactivated account can't keep acting on a stale cookie;
 * use it for anything role-sensitive.
 */

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const session = await getSession();
  if (!session) return null;
  try {
    const user = await UsersRepo.get(session.uid);
    return user.active ? user : null;
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Unauthorized", 401);
  return user;
}

export async function requireAdmin(): Promise<AppUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new AuthError("Forbidden — admin only", 403);
  return user;
}
