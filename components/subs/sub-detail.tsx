"use client";

import { useQuery } from "@tanstack/react-query";

import { SubForm } from "@/components/subs/sub-form";
import type { Sub } from "@/lib/airtable/types";

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
