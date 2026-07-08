"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Mail,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { JobQuickEdit } from "@/components/jobs/job-quick-edit";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { EmailTemplate, Job, Sub } from "@/lib/airtable/types";
import { cn } from "@/lib/utils";

import type { TriageJob } from "@/app/api/jobs/triage/route";

async function fetchTriage(): Promise<TriageJob[]> {
  const res = await fetch("/api/jobs/triage", { cache: "no-store" });
  const data = (await res.json()) as { jobs?: TriageJob[]; error?: string };
  if (!res.ok || !data.jobs) throw new Error(data.error || "Failed to load triage");
  return data.jobs;
}

async function fetchSubs(): Promise<Sub[]> {
  const res = await fetch("/api/subs?activeOnly=true", { cache: "no-store" });
  const data = (await res.json()) as { subs?: Sub[]; error?: string };
  if (!res.ok || !data.subs) throw new Error(data.error || "Failed to load subs");
  return data.subs;
}

type JobPatch = Partial<{
  emailSent: boolean;
  customerReplied: boolean;
  colorsReceived: boolean;
  workOrderReady: boolean;
  assignedSubId: string | null;
}>;

async function patchJob(id: string, patch: JobPatch): Promise<Job> {
  const res = await fetch(`/api/jobs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = (await res.json()) as { job?: Job; error?: string };
  if (!res.ok || !data.job) throw new Error(data.error || "Update failed");
  return data.job;
}

export function JobsTriage() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);

  const triage = useQuery({ queryKey: ["jobs", "triage"], queryFn: fetchTriage });
  const subs = useQuery({ queryKey: ["subs", "active"], queryFn: fetchSubs });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: JobPatch }) =>
      patchJob(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ["jobs", "triage"] });
      const prev = qc.getQueryData<TriageJob[]>(["jobs", "triage"]);
      qc.setQueryData<TriageJob[]>(["jobs", "triage"], (old) =>
        (old ?? []).map((j) => {
          if (j.id !== id) return j;
          const next: TriageJob = {
            ...j,
            ...(patch.emailSent !== undefined && { emailSent: patch.emailSent }),
            ...(patch.customerReplied !== undefined && {
              customerReplied: patch.customerReplied,
            }),
            ...(patch.colorsReceived !== undefined && {
              colorsReceived: patch.colorsReceived,
            }),
            ...(patch.workOrderReady !== undefined && {
              workOrderReady: patch.workOrderReady,
            }),
            ...(patch.assignedSubId !== undefined && {
              assignedSubId: patch.assignedSubId ?? undefined,
            }),
            staging: {
              ...j.staging,
              emailSent: patch.emailSent ?? j.staging.emailSent,
              customerReplied:
                patch.customerReplied ?? j.staging.customerReplied,
              colorsReceived:
                patch.colorsReceived ?? j.staging.colorsReceived,
              workOrderReady:
                patch.workOrderReady ?? j.staging.workOrderReady,
              crewAssigned:
                patch.assignedSubId !== undefined
                  ? Boolean(patch.assignedSubId)
                  : j.staging.crewAssigned,
            },
          };
          return next;
        }),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["jobs", "triage"], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["jobs", "triage"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });

  if (triage.isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  }
  if (triage.error) {
    return (
      <div className="m-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        {triage.error instanceof Error ? triage.error.message : "Failed to load triage"}
      </div>
    );
  }
  const all = triage.data ?? [];
  if (all.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No accepted projects waiting on staging. ✨
      </div>
    );
  }

  // Jobs still needing prep at top; fully-staged "ready to go" jobs at the
  // bottom in their own muted section. A job stays in triage until its status
  // advances to In Progress.
  const working = all.filter((j) => !j.staging.ready);
  const ready = all.filter((j) => j.staging.ready);

  const renderRow = (j: TriageJob, muted = false) => (
    <TriageRow
      key={j.id}
      job={j}
      muted={muted}
      subs={subs.data ?? []}
      onPatch={(patch) => update.mutate({ id: j.id, patch })}
      onOpenDetails={() => setEditingId(j.id)}
    />
  );

  return (
    <>
      {working.length > 0 ? (
        <ul className="divide-y">{working.map((j) => renderRow(j))}</ul>
      ) : (
        <div className="p-4 text-sm text-muted-foreground">
          Nothing to triage right now — everything ready to go below. ✨
        </div>
      )}

      {ready.length > 0 && (
        <>
          <div className="flex items-center gap-2 border-y bg-muted/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <CheckCircle2 className="size-4" />
            Ready to go
            <span className="ml-1 font-normal opacity-70">
              ({ready.length})
            </span>
          </div>
          <ul className="divide-y">{ready.map((j) => renderRow(j, true))}</ul>
        </>
      )}

      <JobQuickEdit jobId={editingId} onClose={() => setEditingId(null)} />
    </>
  );
}

function TriageRow({
  job,
  subs,
  muted = false,
  onPatch,
  onOpenDetails,
}: {
  job: TriageJob;
  subs: Sub[];
  muted?: boolean;
  onPatch: (patch: JobPatch) => void;
  onOpenDetails: () => void;
}) {
  return (
    <li className={cn("px-4 py-3", muted && "opacity-70")}>
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onOpenDetails}
          className="min-w-0 flex-1 text-left"
        >
          <div className="truncate font-medium">
            {job.name || job.customerName || "Job"}
          </div>
          <div className="truncate text-sm text-muted-foreground">
            {[job.customerName, job.address].filter(Boolean).join(" · ") || "—"}
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {job.staging.needsAttention && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
              title={
                job.staging.daysUntilStart !== undefined
                  ? `Starts in ${job.staging.daysUntilStart} day(s)`
                  : undefined
              }
            >
              <AlertTriangle className="size-3" />
              {job.staging.daysUntilStart !== undefined &&
              job.staging.daysUntilStart >= 0
                ? `${job.staging.daysUntilStart}d`
                : "Overdue"}
            </span>
          )}
          <span className="text-xs tabular-nums text-muted-foreground">
            {job.staging.done}/{job.staging.total}
          </span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <CheckPill
          label="Email"
          checked={job.staging.emailSent}
          onChange={(v) => onPatch({ emailSent: v })}
        />
        {!job.staging.emailSent && (
          <SendEmailPill job={job} onPatch={onPatch} />
        )}
        <CheckPill
          label="Reply"
          checked={job.staging.customerReplied}
          onChange={(v) => onPatch({ customerReplied: v })}
        />
        <CheckPill
          label="Colors"
          checked={job.staging.colorsReceived}
          onChange={(v) => onPatch({ colorsReceived: v })}
        />
        <CheckPill
          label="WO Ready"
          checked={job.staging.workOrderReady}
          onChange={(v) => onPatch({ workOrderReady: v })}
        />
        <CrewPill
          job={job}
          subs={subs}
          onAssign={(subId) => onPatch({ assignedSubId: subId })}
        />
        <SchedulePill job={job} />
      </div>
    </li>
  );
}

function CheckPill({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
        checked
          ? "border-emerald-600/50 bg-emerald-50 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100"
          : "border-input bg-background text-muted-foreground hover:bg-muted/40",
      )}
    >
      <span
        className={cn(
          "inline-flex size-4 items-center justify-center rounded-full border",
          checked ? "border-emerald-600 bg-emerald-600" : "border-input",
        )}
      >
        {checked && <Check className="size-3 text-white" strokeWidth={3} />}
      </span>
      <span>{label}</span>
    </button>
  );
}

function CrewPill({
  job,
  subs,
  onAssign,
}: {
  job: TriageJob;
  subs: Sub[];
  onAssign: (subId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (job.assignedSubId) {
    const sub = subs.find((s) => s.id === job.assignedSubId);
    return (
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-emerald-600/50 bg-emerald-50 px-2.5 text-xs text-emerald-900 transition-colors hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-100"
        >
          <span className="inline-flex size-4 items-center justify-center rounded-full border border-emerald-600 bg-emerald-600">
            <Check className="size-3 text-white" strokeWidth={3} />
          </span>
          <span className="max-w-[8rem] truncate">{sub?.name ?? "Crew"}</span>
          <ChevronDown className="size-3" />
        </button>
        {open && (
          <CrewMenu
            subs={subs}
            currentId={job.assignedSubId}
            onPick={(id) => {
              setOpen(false);
              onAssign(id);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-input bg-background px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40"
      >
        <Plus className="size-3.5" />
        <span>Crew</span>
      </button>
      {open && (
        <CrewMenu
          subs={subs}
          currentId={undefined}
          onPick={(id) => {
            setOpen(false);
            onAssign(id);
          }}
        />
      )}
    </div>
  );
}

function CrewMenu({
  subs,
  currentId,
  onPick,
}: {
  subs: Sub[];
  currentId?: string;
  onPick: (id: string | null) => void;
}) {
  return (
    <div className="absolute left-0 top-full z-30 mt-1 max-h-64 w-56 overflow-auto rounded-md border bg-background shadow-md">
      {currentId && (
        <button
          type="button"
          onClick={() => onPick(null)}
          className="block w-full px-3 py-2 text-left text-sm text-destructive hover:bg-muted/40"
        >
          Unassign
        </button>
      )}
      {subs.length === 0 ? (
        <div className="px-3 py-2 text-sm text-muted-foreground">
          No active subs.
        </div>
      ) : (
        subs.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s.id)}
            className={cn(
              "block w-full px-3 py-2 text-left text-sm hover:bg-muted/40",
              s.id === currentId && "bg-muted/60",
            )}
          >
            {s.name}
          </button>
        ))
      )}
    </div>
  );
}

/* ---- Send email (templated) ---------------------------------------------- */

/**
 * Pick the template whose name matches the job's project type. Exact match
 * first, then suffix, then substring (longest name wins) — so "Exterior
 * Staining" finds "Staining" and "Exterior Painting" finds "Exterior". No
 * match → "" and the dialog forces a manual pick.
 */
function defaultTemplateId(templates: EmailTemplate[], projectType?: string): string {
  if (!projectType) return "";
  const pt = projectType.toLowerCase();
  const byLength = (a: EmailTemplate, b: EmailTemplate) => b.name.length - a.name.length;
  const exact = templates.find((t) => t.name.toLowerCase() === pt);
  if (exact) return exact.id;
  const suffix = [...templates].sort(byLength).find((t) => pt.endsWith(t.name.toLowerCase()));
  if (suffix) return suffix.id;
  const within = [...templates].sort(byLength).find((t) => pt.includes(t.name.toLowerCase()));
  return within?.id ?? "";
}

function SendEmailPill({
  job,
  onPatch,
}: {
  job: TriageJob;
  onPatch: (patch: JobPatch) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-input bg-background px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40"
      >
        <Mail className="size-3.5" />
        <span>Send email</span>
      </button>
      {open && (
        <SendEmailDialog job={job} onPatch={onPatch} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function SendEmailDialog({
  job,
  onPatch,
  onClose,
}: {
  job: TriageJob;
  onPatch: (patch: JobPatch) => void;
  onClose: () => void;
}) {
  const q = useQuery({
    queryKey: ["templates"],
    queryFn: async (): Promise<{ templates: EmailTemplate[] }> => {
      const res = await fetch("/api/templates", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load templates");
      return data;
    },
  });
  const templates = q.data?.templates ?? [];

  // "" until templates load or when the project type matches nothing — the
  // open button stays disabled until a template is actually chosen.
  const [picked, setPicked] = useState<string | null>(null);
  const selectedId = picked ?? defaultTemplateId(templates, job.projectType);
  const selected = templates.find((t) => t.id === selectedId);
  const [markSent, setMarkSent] = useState(true);

  function openEmail() {
    if (!selected) return;
    const to = job.customerEmail ?? "";
    const url =
      `mailto:${encodeURIComponent(to)}` +
      `?subject=${encodeURIComponent(selected.subject)}` +
      `&body=${encodeURIComponent(selected.body)}`;
    window.location.href = url;
    if (markSent) onPatch({ emailSent: true });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="absolute left-1/2 top-1/2 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Mail className="size-4" /> Open email template
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Opens your email client with the template loaded
          {job.customerEmail ? (
            <> — to <span className="font-medium">{job.customerEmail}</span></>
          ) : (
            <> — <span className="font-medium text-warning">no customer email on file</span>, you&apos;ll add the recipient yourself</>
          )}
          . Send it from your company address so it lands in GoHighLevel.
        </p>

        {q.isLoading && <p className="mt-3 text-sm text-muted-foreground">Loading templates…</p>}
        {q.error && (
          <p className="mt-3 text-sm text-destructive">
            {q.error instanceof Error ? q.error.message : "Failed to load templates"}
          </p>
        )}

        {q.data && (
          <>
            <div className="mt-3 space-y-1">
              <Label htmlFor={`tpl-${job.id}`} className="text-xs">
                Template{job.projectType ? ` (job type: ${job.projectType})` : ""}
              </Label>
              <select
                id={`tpl-${job.id}`}
                value={selectedId}
                onChange={(e) => setPicked(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Choose a template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <label className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={markSent}
                onChange={(e) => setMarkSent(e.target.checked)}
                className="size-3.5"
              />
              Mark &ldquo;Email&rdquo; as sent
            </label>
            <div className="mt-4 flex gap-2">
              <Button size="sm" disabled={!selected} onClick={openEmail} className="gap-1.5">
                <Mail className="size-4" /> Open email
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SchedulePill({ job }: { job: TriageJob }) {
  if (job.scheduledStart) {
    return (
      <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-emerald-600/50 bg-emerald-50 px-2.5 text-xs text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100">
        <span className="inline-flex size-4 items-center justify-center rounded-full border border-emerald-600 bg-emerald-600">
          <Check className="size-3 text-white" strokeWidth={3} />
        </span>
        <Calendar className="size-3" />
        <span className="tabular-nums">
          {job.scheduledStart}
          {job.scheduledEnd && job.scheduledEnd !== job.scheduledStart
            ? ` → ${job.scheduledEnd}`
            : ""}
        </span>
      </span>
    );
  }
  return (
    <Link
      href={`/schedule?focus=${job.id}`}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-input bg-background px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40"
    >
      <Plus className="size-3.5" />
      <span>Schedule</span>
    </Link>
  );
}
