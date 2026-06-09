"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, RotateCcw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Job } from "@/lib/airtable/types";
import { formatCurrency, formatPercent } from "@/lib/costing/format";
import { cn } from "@/lib/utils";

type JobCostingPatch = Partial<{
  projectAmount: number | null;
  subPayout: number | null;
  jobCostingComplete: boolean;
}>;

async function patchJob(id: string, patch: JobCostingPatch): Promise<Job> {
  const res = await fetch(`/api/jobs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = (await res.json()) as { job?: Job; error?: string };
  if (!res.ok || !data.job) throw new Error(data.error || "Failed to update job");
  return data.job;
}

function numOrNull(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Edits the two manual costing inputs (customer total + crew pay) for one job,
 * shows the Airtable-computed results read-only, and finalizes / reopens the
 * job's costing. Used inline on the worklist and inside the dashboard modal.
 *
 * Local input state is seeded from the job on mount; callers render this with a
 * `key={job.id}` so switching jobs remounts it with fresh values.
 */
export function JobCostingEditor({
  job,
  onDone,
}: {
  job: Job;
  onDone?: () => void;
}) {
  const qc = useQueryClient();
  const [projectAmount, setProjectAmount] = useState(
    job.projectAmount?.toString() ?? "",
  );
  const [subPayout, setSubPayout] = useState(job.subPayout?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["costing"] });
    qc.invalidateQueries({ queryKey: ["jobs"] });
    qc.invalidateQueries({ queryKey: ["job", job.id] });
  }

  const save = useMutation({
    mutationFn: (patch: JobCostingPatch) => patchJob(job.id, patch),
    onSuccess: () => {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1200);
      invalidate();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Save failed"),
  });

  const finalize = useMutation({
    mutationFn: (complete: boolean) =>
      patchJob(job.id, {
        // Persist the latest manual inputs alongside the flag flip.
        projectAmount: numOrNull(projectAmount),
        subPayout: numOrNull(subPayout),
        jobCostingComplete: complete,
      }),
    onSuccess: () => {
      invalidate();
      onDone?.();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Save failed"),
  });

  const dirty =
    numOrNull(projectAmount) !== (job.projectAmount ?? null) ||
    numOrNull(subPayout) !== (job.subPayout ?? null);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`pa-${job.id}`}>Customer total ($)</Label>
          <Input
            id={`pa-${job.id}`}
            inputMode="decimal"
            value={projectAmount}
            onChange={(e) => setProjectAmount(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`sp-${job.id}`}>Crew pay ($)</Label>
          <Input
            id={`sp-${job.id}`}
            inputMode="decimal"
            value={subPayout}
            onChange={(e) => setSubPayout(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md bg-muted/40 p-3 text-sm">
        <Stat label="Materials (invoices)" value={formatCurrency(job.totalMaterialsExpense)} />
        <Stat label="Total COGS" value={formatCurrency(job.totalCogs)} />
        <Stat label="Gross profit" value={formatCurrency(job.grossProfit)} strong />
        <Stat label="Gross profit %" value={formatPercent(job.grossProfitPct)} strong />
        {(job.laborOverage ?? 0) > 0 && (
          <Stat label="Labor overage" value={formatCurrency(job.laborOverage)} warn />
        )}
        {(job.materialsOverage ?? 0) > 0 && (
          <Stat label="Materials overage" value={formatCurrency(job.materialsOverage)} warn />
        )}
      </dl>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!dirty || save.isPending}
          onClick={() =>
            save.mutate({
              projectAmount: numOrNull(projectAmount),
              subPayout: numOrNull(subPayout),
            })
          }
        >
          {save.isPending ? "Saving…" : "Save"}
        </Button>

        {job.jobCostingComplete ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={finalize.isPending}
            onClick={() => finalize.mutate(false)}
          >
            <RotateCcw className="size-4" />
            Reopen costing
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={finalize.isPending}
            onClick={() => finalize.mutate(true)}
          >
            <Check className="size-4" />
            {finalize.isPending ? "Saving…" : "Mark costing complete"}
          </Button>
        )}

        {savedFlash && (
          <span aria-live="polite" className="text-xs text-emerald-700 dark:text-emerald-400">
            Saved.
          </span>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  strong,
  warn,
}: {
  label: string;
  value: string;
  strong?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "tabular-nums",
          strong && "font-semibold",
          warn && "font-semibold text-amber-700 dark:text-amber-400",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
