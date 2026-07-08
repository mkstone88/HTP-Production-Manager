"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  CalendarPlus,
  Check,
  CircleAlert,
  CircleX,
  Clock,
  Ellipsis,
  ExternalLink,
  Inbox,
  LoaderCircle,
  Mail,
  Phone,
  Plus,
  RotateCcw,
  Trash2,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Lead, ReconcileResult } from "@/lib/airtable/types";
import { DisqualifyReason, LeadSource, OppJobType } from "@/lib/airtable/types";
import { cn } from "@/lib/utils";

type Tab = "queue" | "booked" | "missed";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data as T;
}

export function LeadsSuite() {
  const [tab, setTab] = useState<Tab>("queue");
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Leads</h1>
        <Button
          size="sm"
          className="ml-auto h-10 gap-1.5 px-3 sm:h-9"
          onClick={() => setAdding((v) => !v)}
        >
          <Plus className="size-4" />
          New lead
        </Button>
      </div>

      <div role="tablist" className="flex gap-1 border-b px-2 py-2 sm:px-3">
        <TabButton active={tab === "queue"} onClick={() => setTab("queue")}>
          Work queue
        </TabButton>
        <TabButton active={tab === "booked"} onClick={() => setTab("booked")}>
          Booked
        </TabButton>
        <TabButton active={tab === "missed"} onClick={() => setTab("missed")}>
          Missed
        </TabButton>
      </div>

      {adding && <NewLeadForm onClose={() => setAdding(false)} />}

      {tab === "queue" && <QueueTab />}
      {tab === "booked" && <BookedTab />}
      {tab === "missed" && <MissedTab />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "h-10 rounded-md px-3 text-sm font-medium transition-colors",
        active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted/60",
      )}
    >
      {children}
    </button>
  );
}

/* ---- Work queue ---------------------------------------------------------- */

function QueueTab() {
  const q = useQuery({ queryKey: ["leads", "queue"], queryFn: () => getJson<{ leads: Lead[] }>("/api/leads/queue") });
  const leads = q.data?.leads ?? [];
  const overdue = leads.filter((l) => l.overdue).length;

  if (q.isLoading) return <Loading label="Loading the queue…" />;
  if (q.error) return <ErrorBox error={q.error} />;
  if (leads.length === 0)
    return (
      <Empty
        icon={Inbox}
        title="Queue is clear"
        body="Every incoming lead has been worked to an outcome. Nice."
      />
    );

  return (
    <div className="space-y-3 p-4 sm:p-6">
      <p className="text-sm text-muted-foreground">
        {leads.length} open · {overdue > 0 ? <span className="font-medium text-warning">{overdue} due now</span> : "none overdue"}
      </p>
      {leads.map((lead) => (
        <LeadCard key={lead.id} lead={lead} />
      ))}
    </div>
  );
}

function LeadCard({ lead }: { lead: Lead }) {
  const qc = useQueryClient();
  const [panel, setPanel] = useState<"book" | "dq" | null>(null);
  const [apptAt, setApptAt] = useState("");
  const [reason, setReason] = useState<string>(DisqualifyReason.options[0]);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  const act = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Action failed");
      return data;
    },
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["leads", "queue"] });
      qc.invalidateQueries({ queryKey: ["leads", "recent"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Action failed"),
  });

  const del = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json())?.error || "Delete failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads", "queue"] }),
    onError: (e) => setError(e instanceof Error ? e.message : "Delete failed"),
  });

  const busy = act.isPending || del.isPending;

  return (
    <Card className={cn("p-4", lead.overdue && "border-warning/40")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{lead.name}</span>
            {lead.status === "Reschedule Needed" && (
              <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning">
                Reschedule
              </span>
            )}
            <GhlLink url={lead.ghlUrl} />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
            {lead.phone && (
              <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                <Phone className="size-3.5" /> {lead.phone}
              </a>
            )}
            {lead.email && (
              <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                <Mail className="size-3.5" /> {lead.email}
              </a>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {lead.source && <Tag>{lead.source}</Tag>}
            {lead.jobType && <Tag>{lead.jobType}</Tag>}
            {lead.contactAttempts > 0 && <Tag>{lead.contactAttempts} contact{lead.contactAttempts === 1 ? "" : "s"}</Tag>}
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs">
          {lead.overdue ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 font-medium text-warning">
              <CircleAlert className="size-3.5" /> Due
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Clock className="size-3.5" />
              {lead.ageDays != null ? `${lead.ageDays}d old` : ""}
            </span>
          )}
        </div>
      </div>

      {lead.notes && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{lead.notes}</p>}

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      {/* Sub-panels */}
      {panel === "book" && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md border bg-muted/30 p-3">
          <div className="space-y-1">
            <Label htmlFor={`appt-${lead.id}`} className="text-xs">Appointment (optional)</Label>
            <Input
              id={`appt-${lead.id}`}
              type="datetime-local"
              value={apptAt}
              onChange={(e) => setApptAt(e.target.value)}
              className="h-9 w-56"
            />
          </div>
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              act.mutate({
                action: "book",
                appointmentAt: apptAt ? new Date(apptAt).toISOString() : undefined,
              })
            }
          >
            Confirm booking
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPanel(null)}>Cancel</Button>
        </div>
      )}
      {panel === "dq" && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md border bg-muted/30 p-3">
          <div className="space-y-1">
            <Label htmlFor={`dq-${lead.id}`} className="text-xs">Reason</Label>
            <select
              id={`dq-${lead.id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {DisqualifyReason.options.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <Button size="sm" disabled={busy} onClick={() => act.mutate({ action: "disqualify", reason })}>
            Disqualify
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPanel(null)}>Cancel</Button>
        </div>
      )}

      {/* Action row */}
      {panel === null && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => act.mutate({ action: "contacted" })} className="gap-1.5">
            <Check className="size-4" /> Contacted
          </Button>
          <Button size="sm" disabled={busy} onClick={() => setPanel("book")} className="gap-1.5 bg-success text-success-foreground hover:bg-success/90">
            <CalendarPlus className="size-4" /> Book
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setPanel("dq")} className="gap-1.5">
            <CircleX className="size-4" /> Disqualify
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (confirm(`Abandon ${lead.name}? They'll drop out of the queue.`)) act.mutate({ action: "abandon" });
            }}
            className="gap-1.5"
          >
            <Ban className="size-4" /> Abandon
          </Button>
          <div className="relative ml-auto">
            <Button size="sm" variant="ghost" aria-label="More" onClick={() => setShowMore((v) => !v)}>
              <Ellipsis className="size-4" />
            </Button>
            {showMore && (
              <div className="absolute right-0 z-10 mt-1 w-44 rounded-md border bg-background p-1 shadow-lg" onMouseLeave={() => setShowMore(false)}>
                <MenuItem
                  onClick={() => { setShowMore(false); act.mutate({ action: "reschedule" }); }}
                  icon={RotateCcw}
                >
                  Mark reschedule
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setShowMore(false);
                    if (confirm(`Delete ${lead.name}? This permanently removes the lead (spam/junk only).`)) del.mutate();
                  }}
                  icon={Trash2}
                  danger
                >
                  Delete (junk)
                </MenuItem>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function MenuItem({
  onClick,
  icon: Icon,
  danger,
  children,
}: {
  onClick: () => void;
  icon: typeof RotateCcw;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted",
        danger && "text-destructive",
      )}
    >
      <Icon className="size-4" /> {children}
    </button>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-muted px-2 py-0.5">{children}</span>;
}

/** Deep link to the lead's contact in GoHighLevel. Renders nothing when the
 *  contact isn't linked to GHL (or GHL isn't configured server-side). */
function GhlLink({ url, className }: { url?: string; className?: string }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="Open contact in GoHighLevel"
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      <ExternalLink className="size-3.5" /> GHL
    </a>
  );
}

/* ---- Booked -------------------------------------------------------------- */

function BookedTab() {
  const q = useQuery({ queryKey: ["leads", "recent"], queryFn: () => getJson<{ leads: Lead[] }>("/api/leads/recent") });
  const leads = q.data?.leads ?? [];

  if (q.isLoading) return <Loading label="Loading booked leads…" />;
  if (q.error) return <ErrorBox error={q.error} />;
  if (leads.length === 0)
    return <Empty icon={CalendarPlus} title="No recent bookings" body="Appointments booked in the last two weeks show here." />;

  return (
    <div className="divide-y">
      {leads.map((l) => (
        <div key={l.id} className="px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">{l.name}</span>
              <GhlLink url={l.ghlUrl} />
            </div>
            <span className="text-xs text-muted-foreground">
              {l.appointmentAt
                ? new Date(l.appointmentAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
                : l.bookedAt
                  ? `booked ${l.bookedAt.slice(0, 10)}`
                  : ""}
            </span>
          </div>
          <div className="mt-0.5 text-sm text-muted-foreground">
            {[l.phone, l.source].filter(Boolean).join(" · ")}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---- Missed (run sweep + import) ---------------------------------------- */

function MissedTab() {
  const qc = useQueryClient();
  const [imported, setImported] = useState<Set<string>>(new Set());

  const sweep = useMutation({
    mutationFn: () => getJson<ReconcileResult>("/api/reconcile?days=30"),
  });

  const importOne = useMutation({
    mutationFn: async (gap: ReconcileResult["gaps"][number]) => {
      const res = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gap),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Import failed");
      return { ghlId: gap.ghlId };
    },
    onSuccess: ({ ghlId }) => {
      setImported((s) => new Set(s).add(ghlId));
      qc.invalidateQueries({ queryKey: ["leads", "queue"] });
    },
  });

  const gaps = sweep.data?.gaps ?? [];

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="max-w-prose text-sm text-muted-foreground">
          Leads in GoHighLevel with no Airtable record. Import them here so they land
          in the queue. (The nightly sweep also imports these automatically.)
        </p>
        <Button size="sm" className="gap-1.5" disabled={sweep.isPending} onClick={() => sweep.mutate()}>
          {sweep.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <TriangleAlert className="size-4" />}
          Run sweep (30d)
        </Button>
      </div>

      {sweep.error && <ErrorBox error={sweep.error} />}
      {sweep.data && gaps.length === 0 && (
        <Empty icon={Check} title="Nothing missed" body={`Checked ${sweep.data.ghlChecked} GHL leads — all are in Airtable.`} />
      )}

      {gaps.length > 0 && (
        <ul className="divide-y rounded-md border">
          {gaps.map((g) => {
            const done = imported.has(g.ghlId);
            return (
              <li key={g.ghlId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="font-medium">{g.name || "(no name)"}</div>
                  <div className="text-xs text-muted-foreground">
                    {[g.email, g.phone, g.source].filter(Boolean).join(" · ")} · {g.createdAt.slice(0, 10)}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={done ? "ghost" : "default"}
                  disabled={done || importOne.isPending}
                  onClick={() => importOne.mutate(g)}
                >
                  {done ? "Imported" : "Import"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---- New lead form ------------------------------------------------------- */

function NewLeadForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState<string>(LeadSource.options[0]);
  const [jobType, setJobType] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email: email || undefined,
          phone: phone || undefined,
          source,
          jobType: jobType || undefined,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Create failed");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads", "queue"] });
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Create failed"),
  });

  return (
    <Card className="m-4 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <UserPlus className="size-4" /> New lead
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First name" value={firstName} onChange={setFirstName} />
        <Field label="Last name" value={lastName} onChange={setLastName} />
        <Field label="Email" type="email" value={email} onChange={setEmail} />
        <Field label="Phone" value={phone} onChange={setPhone} />
        <div className="space-y-1">
          <Label className="text-xs">Source</Label>
          <select value={source} onChange={(e) => setSource(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
            {LeadSource.options.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Job type</Label>
          <select value={jobType} onChange={(e) => setJobType(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
            <option value="">—</option>
            {OppJobType.options.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="mt-3 space-y-1">
        <Label className="text-xs">Notes</Label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <div className="mt-4 flex gap-2">
        <Button size="sm" disabled={create.isPending} onClick={() => { setError(null); create.mutate(); }}>
          {create.isPending ? "Adding…" : "Add lead"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-9" />
    </div>
  );
}

/* ---- shared states ------------------------------------------------------- */

function Loading({ label }: { label: string }) {
  return <p className="p-4 text-sm text-muted-foreground sm:p-6">{label}</p>;
}
function ErrorBox({ error }: { error: unknown }) {
  return (
    <div className="m-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      {error instanceof Error ? error.message : "Something went wrong."}
    </div>
  );
}
function Empty({ icon: Icon, title, body }: { icon: typeof Inbox; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-2 p-10 text-center">
      <Icon className="size-8 text-muted-foreground" />
      <div className="text-sm font-medium">{title}</div>
      <p className="max-w-prose text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
