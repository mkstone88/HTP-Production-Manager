"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  BarChart3,
  Calendar,
  CalendarCheck,
  ClipboardList,
  DollarSign,
  Ellipsis,
  GitCompare,
  type LucideIcon,
  LogOut,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
  Waypoints,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/components/use-current-user";
import { canAccess } from "@/lib/roles";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV: NavItem[] = [
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/jobs", label: "Jobs", icon: ClipboardList },
  { href: "/subs", label: "Subs", icon: Users },
  { href: "/costing", label: "Costing", icon: DollarSign },
  { href: "/sales", label: "Sales", icon: BarChart3 },
  { href: "/scorecard", label: "Scorecard", icon: CalendarCheck },
  { href: "/leads", label: "Leads", icon: UserPlus },
  { href: "/reconcile", label: "Reconcile", icon: GitCompare },
  { href: "/sources", label: "Sources", icon: Waypoints },
  { href: "/users", label: "Users", icon: ShieldCheck },
];

// How many items fit on the mobile bottom bar before the rest roll into "More".
const MOBILE_PRIMARY = 4;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: user } = useCurrentUser();
  const roles = useMemo(() => user?.roles ?? [], [user]);
  const [moreOpen, setMoreOpen] = useState(false);

  const nav = useMemo(() => NAV.filter((item) => canAccess(roles, item.href)), [roles]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const primary = nav.length > 5 ? nav.slice(0, MOBILE_PRIMARY) : nav;
  const overflow = nav.length > 5 ? nav.slice(MOBILE_PRIMARY) : [];
  const overflowActive = overflow.some((i) => isActive(i.href));
  const mobileCols = primary.length + (overflow.length ? 1 : 0);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      {/* Desktop / tablet sidebar */}
      <aside className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:border-r md:bg-sidebar md:text-sidebar-foreground">
        <div className="flex items-center px-4 py-5">
          <Image
            src="/branding/logo.jpg"
            alt="Hometown Painting"
            width={1920}
            height={739}
            priority
            className="h-9 w-auto"
          />
        </div>
        <div className="px-5 pb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Hometown Ops
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2">
          {nav.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex flex-col gap-1 border-t px-2 py-3">
          {user && (
            <div className="px-3 py-1.5">
              <div className="truncate text-sm font-medium">{user.name || user.email}</div>
              <div className="truncate text-xs text-muted-foreground">
                {roles.length ? roles.join(" · ") : "No roles assigned"}
              </div>
            </div>
          )}
          <Link href="/account">
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
              <Settings className="size-4" />
              Account
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={logout}
          >
            <LogOut className="size-4" />
            Log out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b bg-background px-4 py-3 md:hidden">
        <Link href="/" className="flex items-center">
          <Image
            src="/branding/logo.jpg"
            alt="Hometown Painting"
            width={1920}
            height={739}
            priority
            className="h-7 w-auto"
          />
        </Link>
        <div className="flex items-center gap-1">
          <Link href="/account" aria-label="Account">
            <Button variant="ghost" size="sm">
              <Settings className="size-4" />
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={logout} aria-label="Log out">
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col pb-16 md:pb-0">{children}</main>

      {/* Mobile "More" sheet */}
      {moreOpen && overflow.length > 0 && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute inset-x-0 bottom-16 mx-2 rounded-xl border bg-background p-2 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {overflow.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex h-12 items-center gap-3 rounded-md px-3 text-sm font-medium",
                    active ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="size-5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      {nav.length > 0 && (
        <nav
          className="fixed inset-x-0 bottom-0 z-30 grid border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
          style={{ gridTemplateColumns: `repeat(${mobileCols}, minmax(0, 1fr))` }}
          aria-label="Primary"
        >
          {primary.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return <BottomLink key={item.href} href={item.href} label={item.label} Icon={Icon} active={active} />;
          })}
          {overflow.length > 0 && (
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-label="More"
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 py-2 text-xs transition-colors",
                overflowActive || moreOpen
                  ? "text-[var(--htp-blue)] dark:text-[var(--primary)]"
                  : "text-muted-foreground",
              )}
            >
              <Ellipsis className="size-5" />
              More
            </button>
          )}
        </nav>
      )}
    </div>
  );
}

function BottomLink({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: LucideIcon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1 py-2 text-xs transition-colors",
        active ? "text-[var(--htp-blue)] dark:text-[var(--primary)]" : "text-muted-foreground",
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-[var(--htp-blue)] dark:bg-[var(--primary)]"
        />
      )}
      <Icon className="size-5" />
      {label}
    </Link>
  );
}
