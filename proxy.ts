import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySession } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout"];
// Areas only an admin may reach. Non-admins are bounced (UI) or get 403 (API).
const ADMIN_PATHS = ["/users", "/api/users"];

// Static assets served from /public. Checked in code (not the matcher) so the
// extension exemption can never apply to /api/* routes — otherwise a request
// like /api/jobs/x.png would skip auth entirely.
const STATIC_FILE = /\.(?:png|jpg|jpeg|svg|webp|ico)$/i;

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (matchesPrefix(pathname, PUBLIC_PATHS)) {
    return NextResponse.next();
  }
  if (!pathname.startsWith("/api/") && STATIC_FILE.test(pathname)) {
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

  if (matchesPrefix(pathname, ADMIN_PATHS) && session.role !== "admin") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/schedule";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals; static-file paths are skipped
  // inside proxy() so the exemption stays scoped to non-API routes.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/).*)",
  ],
};
