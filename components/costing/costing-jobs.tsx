"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";

import { JobCostingEditor } from "@/components/costing/job-costing-editor";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Job } from "@/lib/airtable/types";

type DashboardData = {
  needsFinalizing: Job[];
  unassignedInvoiceCount: number;
};

async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch("/api/costing/dashboard", { cache: "no-store" });
  const data = (await res.json()) as DashboardData & { error?: string };
  if (!res.ok || !data.needsFinalizing) {
    throw new Error(data.error || "Failed to load costing worklist");
  }
  return data;
}

export function CostingJobs() {
  const q = useQuery({ queryKey: ["costing", "dashboard"], queryFn: fetchDashboard });
  const jobs = q.data?.needsFinalizing ?? [];
  const unassigned = q.data?.unassignedInvoiceCount ?? 0;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Link
          href="/costing"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted/60"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-lg font-semibold">Finalize job costing</h1>
      </div>

      {unassigned > 0 && (
        <div className="m-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            There {unassigned === 1 ? "is" : "are"} <strong>{unassigned}</strong> unassigned{" "}
            {unassigned === 1 ? "invoice" : "invoices"}. Assign{" "}
            {unassigned === 1 ? "it" : "them"} to jobs before finalizing so the
            material totals are accurate.{" "}
            <Link href="/costing/invoices" className="font-medium underline">
              Go to invoices
            </Link>
          </div>
        </div>
      )}

      {q.isLoading && (
        <div className="p-4 text-sm text-muted-foreground">Loading…</div>
      )}
      {q.error && (
        <div className="m-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {q.error instanceof Error ? q.error.message : "Failed to load."}
        </div>
      )}
      {!q.isLoading && !q.error && jobs.length === 0 && (
        <div className="p-4 text-sm text-muted-foreground">
          No jobs waiting to be costed. 🎉
        </div>
      )}

      <div className="space-y-4 p-4">
        {jobs.map((job) => (
          <Card key={job.id}>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base">
                {job.name || job.customerName || "Job"}
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                {[job.customerName, job.address].filter(Boolean).join(" · ") || "—"}
                {job.scheduledEnd ? ` · completed ${job.scheduledEnd}` : ""}
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <JobCostingEditor job={job} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
