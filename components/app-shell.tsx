"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import { type LucideIcon, LogOut, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/components/use-current-user";
import { activeSection, sectionsFor } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: user } = useCurrentUser();
  const roles = useMemo(() => user?.roles ?? [], [user]);

  const sections = useMemo(() => sectionsFor(roles), [roles]);
  const current = useMemo(() => activeSection(pathname, roles), [pathname, roles]);
  const subItems = current?.items ?? [];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  // Mobile shows a bottom section-switcher only when there's more than one
  // section to switch between; a single-section user navigates via the sub-nav.
  const showSwitcher = sections.length > 1;

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      {/* Desktop / tablet sidebar — grouped by section */}
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
        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 pb-3">
          {sections.map((section) => (
            <div key={section.key} className="flex flex-col gap-1">
              <div className="flex items-center gap-2 px-3 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <section.icon className="size-3.5" />
                {section.label}
              </div>
              {section.items.map((item) => {
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
            </div>
          ))}
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

      {/* Mobile sub-nav — the active section's pages */}
      {subItems.length > 0 && (
        <nav
          className="flex gap-1 overflow-x-auto border-b bg-background px-2 py-2 md:hidden"
          aria-label={current ? `${current.label} pages` : "Pages"}
        >
          {subItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted/60",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}

      {/* Main content */}
      <main className={cn("flex flex-1 flex-col", showSwitcher ? "pb-16 md:pb-0" : "")}>
        {children}
      </main>

      {/* Mobile bottom nav — section switcher */}
      {showSwitcher && (
        <nav
          className="fixed inset-x-0 bottom-0 z-30 grid border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
          style={{ gridTemplateColumns: `repeat(${sections.length}, minmax(0, 1fr))` }}
          aria-label="Sections"
        >
          {sections.map((section) => (
            <SectionTab
              key={section.key}
              href={section.items[0]?.href ?? "/"}
              label={section.label}
              Icon={section.icon}
              active={current?.key === section.key}
            />
          ))}
        </nav>
      )}
    </div>
  );
}

function SectionTab({
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
        "relative flex flex-col items-center justify-center gap-1 px-1 py-2 text-center text-[11px] leading-tight transition-colors",
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
