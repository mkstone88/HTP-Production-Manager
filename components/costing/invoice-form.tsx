"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { JobPicker } from "@/components/costing/job-picker";
import { Modal } from "@/components/costing/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Job, MaterialsExpense } from "@/lib/airtable/types";

type CreatePayload = {
  vendor?: string;
  invoiceDate?: string;
  invoiceNumber?: string;
  po?: string;
  projectId?: string;
  invoiceTotal?: number;
  gallons?: number;
  totalSupplies?: number;
  totalPaint?: number;
};

async function createInvoice(payload: CreatePayload): Promise<MaterialsExpense> {
  const res = await fetch("/api/materials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { invoice?: MaterialsExpense; error?: string };
  if (!res.ok || !data.invoice) throw new Error(data.error || "Failed to create invoice");
  return data.invoice;
}

function num(v: string): number | undefined {
  const t = v.trim();
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Manual entry for an invoice the email automation didn't capture. Vendor is a
 * select of existing Airtable choices (writing an unknown single-select value
 * would be rejected), so we only offer vendors already seen on other invoices.
 */
export function InvoiceForm({
  vendors,
  jobs,
  onClose,
}: {
  vendors: string[];
  jobs: Job[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [vendor, setVendor] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [po, setPo] = useState("");
  const [invoiceTotal, setInvoiceTotal] = useState("");
  const [gallons, setGallons] = useState("");
  const [totalSupplies, setTotalSupplies] = useState("");
  const [totalPaint, setTotalPaint] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      createInvoice({
        vendor: vendor || undefined,
        invoiceDate: invoiceDate || undefined,
        invoiceNumber: invoiceNumber || undefined,
        po: po || undefined,
        projectId: projectId || undefined,
        invoiceTotal: num(invoiceTotal),
        gallons: num(gallons),
        totalSupplies: num(totalSupplies),
        totalPaint: num(totalPaint),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["materials"] });
      qc.invalidateQueries({ queryKey: ["costing"] });
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Failed to create invoice"),
  });

  return (
    <Modal title="Add invoice" subtitle="Manually enter a materials expense" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="inv-vendor">Vendor</Label>
          <select
            id="inv-vendor"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">—</option>
            {vendors.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="inv-date">Invoice date</Label>
            <Input
              id="inv-date"
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="inv-num">Invoice #</Label>
            <Input
              id="inv-num"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="inv-po">PO# (job address)</Label>
          <Input id="inv-po" value={po} onChange={(e) => setPo(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="inv-total">Invoice total ($)</Label>
            <Input
              id="inv-total"
              inputMode="decimal"
              value={invoiceTotal}
              onChange={(e) => setInvoiceTotal(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="inv-gal"># of gallons</Label>
            <Input
              id="inv-gal"
              inputMode="decimal"
              value={gallons}
              onChange={(e) => setGallons(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="inv-sup">Supplies ($)</Label>
            <Input
              id="inv-sup"
              inputMode="decimal"
              value={totalSupplies}
              onChange={(e) => setTotalSupplies(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="inv-paint">Paint ($)</Label>
            <Input
              id="inv-paint"
              inputMode="decimal"
              value={totalPaint}
              onChange={(e) => setTotalPaint(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label>Assign to job (optional)</Label>
          <JobPicker
            jobs={jobs}
            value={projectId ?? undefined}
            onSelect={setProjectId}
            poHint={po || undefined}
          />
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Add invoice"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
