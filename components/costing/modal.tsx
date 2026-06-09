"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Bottom-sheet on mobile / centered dialog on desktop. Mirrors JobQuickEdit. */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 animate-in fade-in bg-black/40 duration-200"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative w-full max-w-md overflow-hidden bg-background shadow-xl",
          "rounded-t-2xl sm:rounded-2xl",
          "animate-in slide-in-from-bottom duration-200 sm:slide-in-from-bottom-0 sm:zoom-in-95",
          "max-h-[88dvh]",
        )}
      >
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-muted sm:hidden" />
        <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold sm:text-lg">{title}</h2>
            {subtitle && (
              <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-9 w-9 shrink-0 p-0"
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}
