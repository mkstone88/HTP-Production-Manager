"use client";

import { useQuery } from "@tanstack/react-query";
import { Mail, Phone } from "lucide-react";

import { SubForm } from "@/components/subs/sub-form";
import type { Sub } from "@/lib/airtable/types";
import { mailtoHref, telHref } from "@/lib/contact-links";

async function fetchSub(id: string): Promise<Sub> {
  const res = await fetch(`/api/subs/${id}`, { cache: "no-store" });
  const data = (await res.json()) as { sub?: Sub; error?: string };
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
