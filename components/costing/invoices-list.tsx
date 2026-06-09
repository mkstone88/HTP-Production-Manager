"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { InvoiceAssign } from "@/components/costing/invoice-assign";
import { InvoiceForm } from "@/components/costing/invoice-form";
import { Button } from "@/components/ui/button";
import type { Job, MaterialsExpense } from "@/lib/airtable/types";
import { formatCurrency } from "@/lib/costing/format";

async function fetchInvoices(): Promise<MaterialsExpense[]> {
  const res = await fetch("/api/materials", { cache: "no-store" });
  const data = (await res.json()) as { invoices?: MaterialsExpense[]; error?: string };
  if (!res.ok || !data.invoices) throw new Error(data.error || "Failed to load invoices");
  return data.invoices;
}

async function fetchJobs(): Promise<Job[]> {
  const res = await fetch("/api/jobs", { cache: "no-store" });
  const data = (await res.json()) as { jobs?: Job[]; error?: string };
  if (!res.ok || !data.jobs) throw new Error(data.error || "Failed to load jobs");
  return data.jobs;
}

export function InvoicesList() {
  const invoicesQuery = useQuery({ queryKey: ["materials"], queryFn: fetchInvoices });
  const jobsQuery = useQuery({ queryKey: ["jobs"], queryFn: fetchJobs });

  const [adding, setAdding] = useState(false);
  const [assigning, setAssigning] = useState<MaterialsExpense | null>(null);

  const invoices = useMemo(() => invoicesQuery.data ?? [], [invoicesQuery.data]);
  const jobs = useMemo(() => jobsQuery.data ?? [], [jobsQuery.data]);

  const jobsById = useMemo(() => {
    const m = new Map<string, Job>();
    for (const j of jobs) m.set(j.id, j);
    return m;
  }, [jobs]);

  const vendors = useMemo(() => {
    const set = new Set<string>();
    for (const inv of invoices) if (inv.vendor) set.add(inv.vendor);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [invoices]);

  const unassigned = invoices.filter((inv) => !inv.projectId);
  const assigned = invoices.filter((inv) => inv.projectId);

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
        <h1 className="text-lg font-semibold">Invoices</h1>
        <Button
          size="sm"
          className="ml-auto h-10 px-3 sm:h-9"
          onClick={() => setAdding(true)}
        >
          <Plus className="size-4" />
          Add invoice
        </Button>
      </div>

      {(invoicesQuery.isLoading || jobsQuery.isLoading) && (
        <div className="p-4 text-sm text-muted-foreground">Loading…</div>
      )}
      {invoicesQuery.error && (
        <div className="m-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {invoicesQuery.error instanceof Error
            ? invoicesQuery.error.message
            : "Failed to load invoices."}
        </div>
      )}

      {!invoicesQuery.isLoading && !invoicesQuery.error && (
        <div className="space-y-6 p-4">
          <section>
            <h2 className="mb-2 text-sm font-semibold">
              Unassigned{" "}
              <span className="text-muted-foreground">({unassigned.length})</span>
            </h2>
            {unassigned.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Every invoice is assigned to a job. 🎉
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {unassigned.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {inv.vendor || "Invoice"}
                        {inv.invoiceNumber ? ` · #${inv.invoiceNumber}` : ""}
                      </div>
                      <div className="truncate text-sm text-muted-foreground">
                        {[inv.invoiceDate, inv.po].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                    <div className="shrink-0 tabular-nums font-medium">
                      {formatCurrency(inv.invoiceTotal)}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => setAssigning(inv)}
                    >
                      Assign
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold">
              Assigned{" "}
              <span className="text-muted-foreground">({assigned.length})</span>
            </h2>
            {assigned.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assigned invoices yet.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {assigned.map((inv) => {
                  const job = inv.projectId ? jobsById.get(inv.projectId) : undefined;
                  return (
                    <li
                      key={inv.id}
                      className="flex items-center gap-3 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">
                          {inv.vendor || "Invoice"}
                          {inv.invoiceNumber ? ` · #${inv.invoiceNumber}` : ""}
                        </div>
                        <div className="truncate text-sm text-muted-foreground">
                          {job?.name || job?.customerName || "Assigned job"}
                        </div>
                      </div>
                      <div className="shrink-0 tabular-nums font-medium">
                        {formatCurrency(inv.invoiceTotal)}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0"
                        onClick={() => setAssigning(inv)}
                      >
                        Reassign
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      {adding && (
        <InvoiceForm vendors={vendors} jobs={jobs} onClose={() => setAdding(false)} />
      )}
      {assigning && (
        <InvoiceAssign
          invoice={assigning}
          jobs={jobs}
          onClose={() => setAssigning(null)}
        />
      )}
    </div>
  );
}
