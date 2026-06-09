"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Calendar,
  ClipboardList,
  DollarSign,
  LogOut,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/components/use-current-user";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/jobs", label: "Jobs", icon: ClipboardList },
  { href: "/subs", label: "Subs", icon: Users },
  { href: "/costing", label: "Costing", icon: DollarSign },
] as const;

const ADMIN_NAV = [{ href: "/users", label: "Users", icon: ShieldCheck }] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: user } = useCurrentUser();

  const isAdmin = user?.role === "admin";
  const navItems = isAdmin ? [...NAV, ...ADMIN_NAV] : NAV;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

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
          Production Manager
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-2">
          {navItems.map((item) => {
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
            <div className="flex items-center gap-2 px-3 py-1.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{user.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {user.email}
                </div>
              </div>
              <RoleChip role={user.role} />
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
        <Link href="/schedule" className="flex items-center">
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

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
        style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
        aria-label="Primary"
      >
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 py-2 text-xs transition-colors",
                active
                  ? "text-[var(--htp-blue)] dark:text-[var(--primary)]"
                  : "text-muted-foreground",
              )}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-[var(--htp-blue)] dark:bg-[var(--primary)]"
                />
              )}
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function RoleChip({ role }: { role: "admin" | "user" }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        role === "admin"
          ? "bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200"
          : "bg-muted text-muted-foreground",
      )}
    >
      {role}
    </span>
  );
}
