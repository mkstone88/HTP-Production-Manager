import "server-only";

import { getSession, sessionHasRole } from "@/lib/session";

/**
 * Reconcile endpoints are reachable two ways:
 *  - A signed-in Office Admin (or Admin) running a sweep manually in the browser.
 *  - Vercel Cron, which sends `Authorization: Bearer ${CRON_SECRET}`.
 *
 * These routes are exempt from the middleware session gate (so cron can reach
 * them with no cookie); this is the actual authorization check.
 */
export async function reconcileAuthorized(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET || "";
  const auth = req.headers.get("authorization") || "";
  if (secret && auth === `Bearer ${secret}`) return true;
  return sessionHasRole(await getSession(), "Office Admin");
}
