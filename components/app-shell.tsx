"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Calendar, ClipboardList, LogOut, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/jobs", label: "Jobs", icon: ClipboardList },
  { href: "/subs", label: "Subs", icon: Users },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      {/* Desktop / tablet sidebar */}
      <aside className="hidden md:flex md:w-56 md:shrink-0 md:flex-col md:border-r md:bg-sidebar md:text-sidebar-foreground">
        <div className="px-5 py-4 text-lg font-semibold tracking-tight">
          HTP
          <span className="ml-1 text-muted-foreground">Production</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-2">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
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
        <div className="px-2 pb-4">
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={logout}>
            <LogOut className="size-4" />
            Log out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b px-4 py-3 md:hidden">
        <span className="text-base font-semibold tracking-tight">HTP Production</span>
        <Button variant="ghost" size="sm" onClick={logout} aria-label="Log out">
          <LogOut className="size-4" />
        </Button>
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col pb-16 md:pb-0">{children}</main>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Primary"
      >
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2 text-xs",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
