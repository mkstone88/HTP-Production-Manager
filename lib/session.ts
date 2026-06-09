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

/**
 * Like `requireUser`, but caches the Airtable lookup briefly so it's cheap
 * enough to call from every mutating data route. Without this check, a
 * deactivated user could keep writing until their cookie expires (30 days) —
 * the middleware only verifies the cookie signature. The cache means
 * deactivation takes up to a minute to bite instead of being instant; use
 * `requireUser`/`requireAdmin` where instant freshness matters.
 */
const USER_CACHE_MS = 60_000;
const userCache = new Map<string, { user: AppUser | null; expiresAt: number }>();

export async function requireActiveUser(): Promise<AppUser> {
  const session = await getSession();
  if (!session) throw new AuthError("Unauthorized", 401);
  const hit = userCache.get(session.uid);
  if (hit && Date.now() < hit.expiresAt) {
    if (!hit.user) throw new AuthError("Unauthorized", 401);
    return hit.user;
  }
  const user = await getCurrentUser();
  userCache.set(session.uid, { user, expiresAt: Date.now() + USER_CACHE_MS });
  if (!user) throw new AuthError("Unauthorized", 401);
  return user;
}

/** Drop a user's cache entry so admin edits (deactivate/demote) bite immediately. */
export function invalidateUserCache(uid: string): void {
  userCache.delete(uid);
}

export async function requireAdmin(): Promise<AppUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new AuthError("Forbidden — admin only", 403);
  return user;
}
