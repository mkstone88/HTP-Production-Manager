import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { canAccess, defaultLanding } from "@/lib/roles";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  // Reconcile endpoints self-authorize (Office Admin session OR Bearer
  // CRON_SECRET) so Vercel Cron can reach them with no session cookie.
  "/api/reconcile",
  // PWA plumbing: the service worker script and its offline fallback must be
  // fetchable without a session or registration/precache breaks.
  "/sw.js",
  "/offline.html",
];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (matchesPrefix(pathname, PUBLIC_PATHS)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // User management is Admin-only (the page is gated by canAccess below; this is
  // the API defense-in-depth).
  if (matchesPrefix(pathname, ["/api/users"]) && !session.roles.includes("Admin")) {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  }

  // Role-gate page sections. Data APIs stay session-only (routes self-check).
  if (!pathname.startsWith("/api/") && !canAccess(session.roles, pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = defaultLanding(session.roles);
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
