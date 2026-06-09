"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Mail, Phone } from "lucide-react";

import { SubForm } from "@/components/subs/sub-form";
import { mailtoHref, telHref } from "@/lib/contact-links";
import type { SubWithCompliance } from "@/lib/subs/compliance";
import { cn } from "@/lib/utils";

async function fetchSub(id: string): Promise<SubWithCompliance> {
  const res = await fetch(`/api/subs/${id}`, { cache: "no-store" });
  const data = (await res.json()) as { sub?: SubWithCompliance; error?: string };
  if (!res.ok || !data.sub) throw new Error(data.error || "Failed to load sub");
  return data.sub;
}

export function SubDetail({ id }: { id: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["sub", id],
    queryFn: () => fetchSub(id),
  });

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b px-4 py-3">
        <h1 className="text-lg font-semibold">
          {data?.name ?? (isLoading ? "Loading…" : "Subcontractor")}
        </h1>
        {(data?.phone || data?.email) && (
          <div className="mt-1.5 flex flex-wrap gap-2">
            {data.phone && (
              <a
                href={telHref(data.phone)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
              >
                <Phone className="size-3.5" />
                {data.phone}
              </a>
            )}
            {data.email && (
              <a
                href={mailtoHref(data.email)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
              >
                <Mail className="size-3.5" />
                {data.email}
              </a>
            )}
          </div>
        )}
      </div>
      {data && data.compliance.issues.length > 0 && (
        <div
          className={cn(
            "mx-4 mt-4 rounded-md border p-3 text-sm",
            data.compliance.status === "expired"
              ? "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-900/20 dark:text-red-200"
              : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-200",
          )}
        >
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4" />
            Compliance
          </div>
          <ul className="mt-1 list-inside list-disc">
            {data.compliance.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
      {isLoading && (
        <div className="p-4 text-sm text-muted-foreground">Loading…</div>
      )}
      {error && (
        <div className="m-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load sub"}
        </div>
      )}
      {data && <SubForm mode="edit" initial={data} />}
    </div>
  );
}
