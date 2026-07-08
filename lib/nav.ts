/**
 * Navigation model: the app's pages grouped into role-scoped SECTIONS. This is a
 * presentation layer over the flat routes — it does NOT grant access. Route
 * access is still enforced by `lib/roles.ts` (middleware + server). Keep the two
 * in sync: a page listed in a section here should be reachable by that section's
 * roles per ROUTE_ACCESS.
 *
 * Imports lucide icons, so this must only be pulled into client/RSC components
 * (never Edge middleware — that's why it lives apart from the pure roles module).
 */

import {
  BarChart3,
  Calendar,
  CalendarCheck,
  ClipboardList,
  DollarSign,
  GitCompare,
  Handshake,
  HardHat,
  type LucideIcon,
  ShieldCheck,
  UserPlus,
  Users,
  Waypoints,
} from "lucide-react";

import { canAccess, type Role } from "@/lib/roles";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export type NavSection = {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Roles (besides Admin) that see this section. Empty = Admin only. */
  roles: Role[];
  items: NavItem[];
};

/**
 * Order matters. A page can appear in more than one section (e.g. Sources is a
 * Sales KPI *and* an appointment-setter attribution tool). `activeSection` walks
 * this list and returns the first section the user can reach that owns the
 * current path — so a Sales user lands on it under Sales, an Office Admin under
 * Appointment Setter, automatically.
 */
export const SECTIONS: NavSection[] = [
  {
    key: "production",
    label: "Production",
    icon: HardHat,
    roles: ["Production Manager"],
    items: [
      { href: "/schedule", label: "Schedule", icon: Calendar },
      { href: "/jobs", label: "Jobs", icon: ClipboardList },
      { href: "/costing", label: "Costing", icon: DollarSign },
      { href: "/subs", label: "Subs", icon: Users },
    ],
  },
  {
    key: "sales",
    label: "Sales",
    icon: BarChart3,
    roles: ["Sales"],
    items: [
      { href: "/deals", label: "Deals", icon: Handshake },
      { href: "/sales", label: "KPIs", icon: BarChart3 },
      { href: "/scorecard", label: "Scorecard", icon: CalendarCheck },
      { href: "/sources", label: "Sources", icon: Waypoints },
    ],
  },
  {
    key: "setter",
    label: "Appointment Setter",
    icon: UserPlus,
    roles: ["Office Admin"],
    items: [
      { href: "/leads", label: "Leads", icon: UserPlus },
      { href: "/sources", label: "Sources", icon: Waypoints },
      { href: "/reconcile", label: "Reconcile", icon: GitCompare },
    ],
  },
  {
    key: "admin",
    label: "Admin",
    icon: ShieldCheck,
    roles: [],
    items: [{ href: "/users", label: "Users", icon: ShieldCheck }],
  },
];

function pathMatches(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Whether a user holding `roles` may see a section at all. */
export function sectionVisible(section: NavSection, roles: readonly string[]): boolean {
  if (roles.includes("Admin")) return true;
  return section.roles.some((r) => roles.includes(r));
}

/** Sections this user can see, each trimmed to the items they can access. */
export function sectionsFor(roles: readonly string[]): NavSection[] {
  return SECTIONS.filter((s) => sectionVisible(s, roles))
    .map((s) => ({ ...s, items: s.items.filter((i) => canAccess(roles, i.href)) }))
    .filter((s) => s.items.length > 0);
}

/** The section the current path belongs to (role-aware), or the first the user has. */
export function activeSection(
  pathname: string,
  roles: readonly string[],
): NavSection | null {
  const visible = sectionsFor(roles);
  return (
    visible.find((s) => s.items.some((i) => pathMatches(i.href, pathname))) ??
    visible[0] ??
    null
  );
}
