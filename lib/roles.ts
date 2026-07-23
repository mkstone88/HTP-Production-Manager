/**
 * Roles + route access. Pure module — no server-only, next/headers, or React —
 * so it's safe to import from middleware (Edge), server components, and client
 * components alike. It's the single source of truth for "who can see what".
 *
 * A user can hold several roles (see the "Roles" multi-select on App Users).
 * Admin is a superset: it can access every section and manage users.
 */

export const ROLES = [
  "Admin",
  "Office Admin",
  "Production Manager",
  "Sales",
  "Subcontractor",
] as const;

export type Role = (typeof ROLES)[number];

export function isRole(v: string): v is Role {
  return (ROLES as readonly string[]).includes(v);
}

/**
 * Access rules by URL section. Each gated prefix lists the roles (besides Admin)
 * that may enter it. Order matters: `defaultLanding` sends a user to the first
 * section they can reach, so keep the most "home-like" sections first per role.
 *
 * Paths not listed here are open to any signed-in user (the middleware still
 * requires a valid session for everything). Sensitive APIs are additionally
 * checked server-side — see the /api/users handlers.
 */
export interface AccessRule {
  /** URL prefix, matched as exact or `${prefix}/...`. */
  prefix: string;
  /** Roles allowed in (Admin is always allowed). */
  roles: Role[];
}

export const ROUTE_ACCESS: AccessRule[] = [
  { prefix: "/schedule", roles: ["Production Manager"] },
  { prefix: "/jobs", roles: ["Production Manager"] },
  { prefix: "/subs", roles: ["Production Manager"] },
  { prefix: "/costing", roles: ["Production Manager"] },
  { prefix: "/sales", roles: ["Sales"] },
  { prefix: "/deals", roles: ["Sales"] },
  { prefix: "/scorecard", roles: ["Sales"] },
  { prefix: "/marketing", roles: ["Sales"] },
  { prefix: "/surveys", roles: ["Sales"] },
  { prefix: "/leads", roles: ["Office Admin"] },
  { prefix: "/reconcile", roles: ["Office Admin"] },
  { prefix: "/sources", roles: ["Office Admin", "Sales"] },
  { prefix: "/users", roles: ["Admin"] },
  { prefix: "/settings", roles: ["Admin"] },
];

function matches(prefix: string, pathname: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** The access rule governing a path, or null if the path isn't gated. */
export function ruleFor(pathname: string): AccessRule | null {
  return ROUTE_ACCESS.find((r) => matches(r.prefix, pathname)) ?? null;
}

/** Whether a user holding `roles` may enter `pathname`. */
export function canAccess(roles: readonly string[], pathname: string): boolean {
  if (roles.includes("Admin")) return true;
  const rule = ruleFor(pathname);
  if (!rule) return true; // not a gated section
  return rule.roles.some((r) => roles.includes(r));
}

/** The first section this user can reach — where to land them after login. */
export function defaultLanding(roles: readonly string[]): string {
  if (roles.includes("Admin")) return "/schedule";
  const first = ROUTE_ACCESS.find((r) => r.roles.some((role) => roles.includes(role)));
  return first ? first.prefix : "/no-access";
}
