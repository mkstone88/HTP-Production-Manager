"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronRight, type LucideIcon, LogOut, Settings } from "lucide-react";

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

  // Desktop sidebar collapse. Default: only the section that owns the current
  // page is open (a single-section user just sees their one section open).
  // Manual toggles override the default until the next full page load.
  const [collapseOverrides, setCollapseOverrides] = useState<Record<string, boolean>>({});
  const isExpanded = (key: string) =>
    collapseOverrides[key] ?? (current?.key === key || sections.length === 1);
  const toggleSection = (key: string) =>
    setCollapseOverrides((o) => ({ ...o, [key]: !isExpanded(key) }));

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
    // `has-bottom-nav` publishes --app-bottom-nav / --app-drawer-inset (see
    // globals.css) so fixed-bottom UI inside pages — e.g. the Schedule
    // drawer — can sit above the section switcher instead of underneath it.
    <div
      className={cn(
        "flex min-h-dvh flex-col md:flex-row",
        showSwitcher && "has-bottom-nav",
      )}
    >
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
        <nav className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3">
          {sections.map((section) => {
            const expanded = isExpanded(section.key);
            const containsActive = section.items.some((i) => isActive(i.href));
            return (
              <div key={section.key} className="flex flex-col">
                <button
                  type="button"
                  onClick={() => toggleSection(section.key)}
                  aria-expanded={expanded}
                  className={cn(
                    "flex h-9 items-center gap-2 rounded-md px-3 text-[11px] font-bold uppercase tracking-wider transition-colors",
                    containsActive || expanded
                      ? "text-sidebar-foreground"
                      : "text-muted-foreground hover:text-sidebar-foreground",
                  )}
                >
                  <ChevronRight
                    className={cn("size-3.5 transition-transform", expanded && "rotate-90")}
                  />
                  <section.icon className="size-3.5" />
                  {section.label}
                </button>
                {/* Sub-pages: indented under a guide rail so section headers and
                    their pages read as two distinct levels. */}
                {expanded && (
                  <div className="mb-1 ml-[1.15rem] flex flex-col gap-0.5 border-l border-border pl-2">
                    {section.items.map((item) => {
                      const active = isActive(item.href);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "flex h-10 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors",
                            active
                              ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                              : "font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                          )}
                        >
                          <Icon className="size-4" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
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
      <header className="flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
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
          className="flex gap-1 overflow-x-auto border-b bg-card px-2 py-2 md:hidden"
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
                    ? "bg-primary text-primary-foreground shadow-sm"
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

      {/* Main content — padded by the real switcher height (incl. the iOS
          home-indicator inset, which pb-16 under-counted). */}
      <main
        className={cn(
          "flex flex-1 flex-col",
          showSwitcher &&
            "pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0",
        )}
      >
        {children}
      </main>

      {/* Mobile bottom nav — section switcher */}
      {showSwitcher && (
        <nav
          className="fixed inset-x-0 bottom-0 z-30 grid border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
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
        // Fixed h-14 so the switcher's height is exactly the 3.5rem that
        // --app-bottom-nav and the <main> bottom padding assume.
        "relative flex h-14 flex-col items-center justify-center gap-1 px-1 text-center text-[11px] leading-tight transition-colors",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-primary"
        />
      )}
      <Icon className="size-5" />
      {label}
    </Link>
  );
}
