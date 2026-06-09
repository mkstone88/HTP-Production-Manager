"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { JobPicker } from "@/components/costing/job-picker";
import { Modal } from "@/components/costing/modal";
import type { Job, MaterialsExpense } from "@/lib/airtable/types";

async function assignInvoice(id: string, projectId: string): Promise<MaterialsExpense> {
  const res = await fetch(`/api/materials/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
  const data = (await res.json()) as { invoice?: MaterialsExpense; error?: string };
  if (!res.ok || !data.invoice) throw new Error(data.error || "Failed to assign invoice");
  return data.invoice;
}

export function InvoiceAssign({
  invoice,
  jobs,
  onClose,
}: {
  invoice: MaterialsExpense;
  jobs: Job[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const assign = useMutation({
    mutationFn: (projectId: string) => assignInvoice(invoice.id, projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["materials"] });
      qc.invalidateQueries({ queryKey: ["costing"] });
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Failed to assign invoice"),
  });

  const subtitle = [invoice.vendor, invoice.invoiceNumber && `#${invoice.invoiceNumber}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <Modal title="Assign invoice to a job" subtitle={subtitle || undefined} onClose={onClose}>
      <JobPicker
        jobs={jobs}
        poHint={invoice.po || undefined}
        onSelect={(jobId) => {
          if (jobId) assign.mutate(jobId);
        }}
      />
      {assign.isPending && (
        <div className="mt-3 text-sm text-muted-foreground">Assigning…</div>
      )}
      {error && (
        <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}
    </Modal>
  );
}
