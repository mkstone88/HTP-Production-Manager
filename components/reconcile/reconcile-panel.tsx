"use client";

import { useMutation } from "@tanstack/react-query";
import {
  CircleCheck,
  GitCompare,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  DupGroup,
  DuplicateReport,
  ProposalReport,
  ReconcileResult,
} from "@/lib/airtable/types";
import { cn } from "@/lib/utils";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data as T;
}

export function ReconcilePanel() {
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <GitCompare className="size-5" />
          Reconcile
        </h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          The safety net. Each sweep is read-only — it reports gaps so nothing
          slips through, and writes nothing. Running one also confirms the app can
          reach that integration.
        </p>
      </div>

      <MissedSweep />
      <ProposalSweep />
      <DuplicatesSweep />
    </div>
  );
}

/* ---- shared bits --------------------------------------------------------- */

function RunButton({
  onClick,
  pending,
  children,
}: {
  onClick: () => void;
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button size="sm" onClick={onClick} disabled={pending} className="gap-2">
      {pending ? (
        <LoaderCircle className="size-4 animate-spin" />
      ) : (
        <RefreshCw className="size-4" />
      )}
      {children}
    </Button>
  );
}

function ErrorBox({ error }: { error: unknown }) {
  return (
    <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      <div className="flex items-center gap-1.5 font-medium">
        <TriangleAlert className="size-4" /> Sweep failed
      </div>
      <p className="mt-1 break-words font-mono text-xs">
        {error instanceof Error ? error.message : String(error)}
      </p>
    </div>
  );
}

function Summary({
  ok,
  children,
}: {
  ok: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mt-3 flex items-center gap-1.5 text-sm font-medium",
        ok ? "text-success" : "text-warning",
      )}
    >
      {ok ? <CircleCheck className="size-4" /> : <TriangleAlert className="size-4" />}
      {children}
    </div>
  );
}

function SweepCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-0.5 max-w-prose text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        {children}
      </div>
    </Card>
  );
}

/* ---- missed leads (GHL) -------------------------------------------------- */

function MissedSweep() {
  const [days, setDays] = useState(7);
  const run = useMutation({
    mutationFn: () => getJson<ReconcileResult>(`/api/reconcile?days=${days}`),
  });
  const r = run.data;

  return (
    <SweepCard
      title="Missed leads"
      description="GHL opportunities with no matching Airtable record — a lead that never made it across."
    >
      <div className="flex items-center gap-2">
        <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-semibold">Days</span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          >
            {[7, 14, 30, 60, 90].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <RunButton onClick={() => run.mutate()} pending={run.isPending}>
          Run
        </RunButton>
      </div>

      <div className="w-full">
        {run.error && <ErrorBox error={run.error} />}
        {r && (
          <>
            <Summary ok={r.gaps.length === 0}>
              Checked {r.ghlChecked} · matched {r.matched} ·{" "}
              {r.gaps.length === 0
                ? "no gaps"
                : `${r.gaps.length} gap${r.gaps.length === 1 ? "" : "s"}`}
            </Summary>
            {r.gaps.length > 0 && (
              <ul className="mt-2 max-h-80 divide-y overflow-y-auto rounded-md border">
                {r.gaps.map((g) => (
                  <li key={g.ghlId} className="px-3 py-2 text-sm">
                    <div className="font-medium">{g.name || "(no name)"}</div>
                    <div className="text-xs text-muted-foreground">
                      {[g.email, g.phone, g.source, g.status].filter(Boolean).join(" · ")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {g.createdAt.slice(0, 10)} · {g.reason}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </SweepCard>
  );
}

/* ---- proposal check (PaintScout) ---------------------------------------- */

function ProposalSweep() {
  const run = useMutation({
    mutationFn: () => getJson<ProposalReport>(`/api/reconcile/proposals`),
  });
  const r = run.data;

  return (
    <SweepCard
      title="Proposal check"
      description="PaintScout quotes missing from Airtable, or whose won/lost outcome disagrees with PaintScout."
    >
      <RunButton onClick={() => run.mutate()} pending={run.isPending}>
        Run
      </RunButton>

      <div className="w-full">
        {run.error && <ErrorBox error={run.error} />}
        {r && (
          <>
            <Summary ok={r.issues.length === 0}>
              Checked {r.quotesChecked} · matched {r.matched} ·{" "}
              {r.issues.length === 0
                ? "no issues"
                : `${r.issues.length} issue${r.issues.length === 1 ? "" : "s"}`}
            </Summary>
            {r.issues.length > 0 && (
              <ul className="mt-2 max-h-80 divide-y overflow-y-auto rounded-md border">
                {r.issues.map((i) => (
                  <li key={`${i.quoteNumber}-${i.kind}`} className="px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        #{i.quoteNumber} · {i.name || i.email || "(no name)"}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {money(i.total)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span
                        className={cn(
                          "mr-1 rounded px-1.5 py-0.5",
                          i.kind === "missing"
                            ? "bg-warning/15 text-warning"
                            : "bg-destructive/15 text-destructive",
                        )}
                      >
                        {i.kind}
                      </span>
                      {i.detail}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </SweepCard>
  );
}

/* ---- duplicates (Airtable) ---------------------------------------------- */

function DuplicatesSweep() {
  const run = useMutation({
    mutationFn: () => getJson<DuplicateReport>(`/api/reconcile/duplicates`),
  });
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const key = (type: string, ghlId: string) => `${type}:${ghlId}`;
  const markResolved = (type: string, ghlId: string) =>
    setResolved((s) => new Set(s).add(key(type, ghlId)));

  const r = run.data;
  const oppGroups = (r?.opportunities ?? []).filter((g) => !resolved.has(key("opportunity", g.ghlId)));
  const contactGroups = (r?.contacts ?? []).filter((g) => !resolved.has(key("contact", g.ghlId)));
  const total = oppGroups.length + contactGroups.length;

  return (
    <SweepCard
      title="Duplicates"
      description="Opportunities or contacts that share a GHL id — usually a Zapier race that created two rows. Pick which to keep; the rest are removed (a contact's opportunities move to the survivor first)."
    >
      <RunButton
        onClick={() => {
          setResolved(new Set());
          run.mutate();
        }}
        pending={run.isPending}
      >
        Run
      </RunButton>

      <div className="w-full">
        {run.error && <ErrorBox error={run.error} />}
        {r && (
          <>
            <Summary ok={total === 0}>
              {total === 0
                ? "No collisions to resolve"
                : `${oppGroups.length} opportunity + ${contactGroups.length} contact collision${total === 1 ? "" : "s"}`}
            </Summary>
            {total > 0 && (
              <div className="mt-2 max-h-96 space-y-4 overflow-y-auto rounded-md border p-3">
                {oppGroups.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Opportunities
                    </div>
                    {oppGroups.map((g) => (
                      <GroupResolver
                        key={g.ghlId}
                        type="opportunity"
                        group={g}
                        onResolved={() => markResolved("opportunity", g.ghlId)}
                      />
                    ))}
                  </div>
                )}
                {contactGroups.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Contacts
                    </div>
                    {contactGroups.map((g) => (
                      <GroupResolver
                        key={g.ghlId}
                        type="contact"
                        group={g}
                        onResolved={() => markResolved("contact", g.ghlId)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </SweepCard>
  );
}

function GroupResolver({
  type,
  group,
  onResolved,
}: {
  type: "opportunity" | "contact";
  group: DupGroup;
  onResolved: () => void;
}) {
  const [keepId, setKeepId] = useState(group.rows[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const removeCount = group.rows.length - 1;

  const resolve = useMutation({
    mutationFn: async () => {
      const removeIds = group.rows.map((r) => r.id).filter((id) => id !== keepId);
      const res = await fetch("/api/reconcile/duplicates/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, keepId, removeIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Resolve failed");
      return data;
    },
    onSuccess: onResolved,
    onError: (e) => setError(e instanceof Error ? e.message : "Resolve failed"),
  });

  return (
    <div className="rounded border bg-muted/30 p-2">
      <div className="font-mono text-xs text-muted-foreground">{group.ghlId}</div>
      <div className="mt-1 space-y-1">
        {group.rows.map((row) => (
          <label key={row.id} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={`keep-${type}-${group.ghlId}`}
              checked={keepId === row.id}
              onChange={() => setKeepId(row.id)}
              className="size-3.5"
            />
            <span>
              {row.label}
              {row.extra ? <span className="text-muted-foreground"> · {row.extra}</span> : null}
            </span>
          </label>
        ))}
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      <div className="mt-2">
        <Button
          size="sm"
          variant="outline"
          disabled={resolve.isPending || !keepId}
          onClick={() => {
            const msg =
              type === "contact"
                ? `Keep the selected contact and merge ${removeCount} duplicate${removeCount === 1 ? "" : "s"} into it? Their opportunities move to the survivor, then the duplicates are deleted.`
                : `Keep the selected opportunity and delete ${removeCount} duplicate${removeCount === 1 ? "" : "s"}? This can't be undone.`;
            if (confirm(msg)) resolve.mutate();
          }}
        >
          {resolve.isPending ? "Resolving…" : `Keep selected · remove ${removeCount}`}
        </Button>
      </div>
    </div>
  );
}
