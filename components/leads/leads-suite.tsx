"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  CalendarClock,
  CalendarPlus,
  Check,
  CircleX,
  Clock,
  Ellipsis,
  ExternalLink,
  Inbox,
  LoaderCircle,
  Mail,
  MessageSquarePlus,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
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

type Tab = "queue" | "booked" | "missed" | "find";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data as T;
}

async function leadAction(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/leads/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Action failed");
  return data as { lead: Lead };
}

/* ---- date formatting ------------------------------------------------------ */

function fmtWhen(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtAgo(iso?: string): string {
  if (!iso) return "";
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function LeadsSuite() {
  const [tab, setTab] = useState<Tab>("queue");
  const [adding, setAdding] = useState(false);

  // Shares the cache with QueueTab (same key). The interval keeps the queue
  // fresh all day for a setter who leaves the PWA open — new inbound leads
  // appear without a manual reload.
  const queue = useQuery({
    queryKey: ["leads", "queue"],
    queryFn: () => getJson<{ leads: Lead[] }>("/api/leads/queue"),
    refetchInterval: 60_000,
  });
  const needsAttention = (queue.data?.leads ?? []).filter((l) => l.overdue).length;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Leads</h1>
        <div className="ml-auto flex items-center gap-2">
          {/* Google LSA leads expose almost nothing through Zapier (often just a
              message), so they're worked in Google's own dashboard until they
              have enough info to enter this queue. */}
          <a
            href="https://ads.google.com/localservices"
            target="_blank"
            rel="noopener noreferrer"
            title="Open the Google Local Services Ads dashboard"
          >
            <Button size="sm" variant="outline" className="h-10 gap-1.5 px-3 sm:h-9">
              <ExternalLink className="size-4" />
              Google LSA
            </Button>
          </a>
          <Button
            size="sm"
            className="h-10 gap-1.5 px-3 sm:h-9"
            onClick={() => setAdding((v) => !v)}
          >
            <Plus className="size-4" />
            New lead
          </Button>
        </div>
      </div>

      <div role="tablist" className="flex gap-1 overflow-x-auto border-b px-2 py-2 sm:px-3">
        <TabButton active={tab === "queue"} onClick={() => setTab("queue")}>
          Work queue
          {needsAttention > 0 && (
            <span className="ml-1.5 rounded-full bg-warning/20 px-1.5 py-0.5 text-xs font-semibold text-warning">
              {needsAttention}
            </span>
          )}
        </TabButton>
        <TabButton active={tab === "booked"} onClick={() => setTab("booked")}>
          Booked
        </TabButton>
        <TabButton active={tab === "missed"} onClick={() => setTab("missed")}>
          Missed
        </TabButton>
        <TabButton active={tab === "find"} onClick={() => setTab("find")}>
          Find
        </TabButton>
      </div>

      {adding && <NewLeadForm onClose={() => setAdding(false)} />}

      {tab === "queue" && <QueueTab />}
      {tab === "booked" && <BookedTab />}
      {tab === "missed" && <MissedTab />}
      {tab === "find" && <FindTab />}
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
        "flex h-10 shrink-0 items-center rounded-md px-3 text-sm font-medium transition-colors",
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
  const due = leads.filter((l) => l.overdue).length;

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
        {leads.length} open ·{" "}
        {due > 0 ? <span className="font-medium text-warning">{due} need attention</span> : "nothing due"}
      </p>
      {leads.map((lead) => (
        <LeadCard key={lead.id} lead={lead} />
      ))}
    </div>
  );
}

/** Queue-position chip: tells the setter WHY this card is where it is. */
function StateChip({ lead }: { lead: Lead }) {
  switch (lead.queueState) {
    case "new":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
          <Sparkles className="size-3.5" /> New — call now
        </span>
      );
    case "callback":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
          <CalendarClock className="size-3.5" /> Callback · {fmtWhen(lead.callbackAt)}
        </span>
      );
    case "decision":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
          <TriangleAlert className="size-3.5" /> {lead.contactAttempts} tries — decide
        </span>
      );
    case "due":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
          <Clock className="size-3.5" /> Follow-up due
        </span>
      );
    default:
      return lead.callbackAt ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          <CalendarClock className="size-3.5" /> Callback {fmtWhen(lead.callbackAt)}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          <Clock className="size-3.5" /> Next {fmtWhen(lead.nextFollowUpDate)}
        </span>
      );
  }
}

function LeadCard({ lead }: { lead: Lead }) {
  const qc = useQueryClient();
  const [panel, setPanel] = useState<"contact" | "book" | "callback" | "dq" | null>(null);
  const [note, setNote] = useState("");
  const [apptAt, setApptAt] = useState("");
  const [callbackAt, setCallbackAt] = useState("");
  const [reason, setReason] = useState<string>(DisqualifyReason.options[0]);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  const act = useMutation({
    mutationFn: (body: Record<string, unknown>) => leadAction(lead.id, body),
    onSuccess: () => {
      setError(null);
      setPanel(null);
      setNote("");
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
    <Card
      className={cn(
        "p-4",
        lead.queueState === "new" && "border-success/50",
        (lead.queueState === "callback" || lead.queueState === "due") && "border-warning/40",
        lead.queueState === "decision" && "border-destructive/40",
      )}
    >
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
          {/* Contact info is display-only: calls, texts, and emails all happen
              inside GoHighLevel (house rule) — the GHL button is the way in. */}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
            {lead.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3.5" /> {lead.phone}
              </span>
            )}
            {lead.email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="size-3.5" /> {lead.email}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {lead.source && <Tag>{lead.source}</Tag>}
            {lead.jobType && <Tag>{lead.jobType}</Tag>}
            {lead.ageDays != null && <Tag>{lead.ageDays}d old</Tag>}
            {lead.contactAttempts > 0 && (
              <span>
                {lead.contactAttempts} contact{lead.contactAttempts === 1 ? "" : "s"}
                {lead.lastContactedAt ? ` · last ${fmtAgo(lead.lastContactedAt)}` : ""}
              </span>
            )}
          </div>
        </div>
        <StateChip lead={lead} />
      </div>

      {lead.notes && (
        <button
          type="button"
          onClick={() => setNotesOpen((v) => !v)}
          className={cn(
            "mt-2 w-full whitespace-pre-wrap text-left text-sm text-muted-foreground",
            !notesOpen && "line-clamp-2",
          )}
        >
          {lead.notes}
        </button>
      )}

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      {/* Sub-panels */}
      {panel === "contact" && (
        <ActionPanel>
          <div className="min-w-0 flex-1 space-y-1">
            <Label htmlFor={`note-${lead.id}`} className="text-xs">
              What happened? (optional — saved to notes)
            </Label>
            <Input
              id={`note-${lead.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Left voicemail / spoke to her, wants exterior quote…"
              className="h-9"
            />
          </div>
          <Button
            size="sm"
            disabled={busy}
            onClick={() => act.mutate({ action: "contacted", note: note || undefined })}
          >
            Log contact
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPanel(null)}>Cancel</Button>
        </ActionPanel>
      )}
      {panel === "book" && (
        <ActionPanel>
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
        </ActionPanel>
      )}
      {panel === "callback" && (
        <ActionPanel>
          <div className="space-y-1">
            <Label htmlFor={`cb-${lead.id}`} className="text-xs">Call them back at</Label>
            <Input
              id={`cb-${lead.id}`}
              type="datetime-local"
              value={callbackAt}
              onChange={(e) => setCallbackAt(e.target.value)}
              className="h-9 w-56"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <Label htmlFor={`cbnote-${lead.id}`} className="text-xs">Note (optional)</Label>
            <Input
              id={`cbnote-${lead.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Asked to call after vacation…"
              className="h-9"
            />
          </div>
          <Button
            size="sm"
            disabled={busy || !callbackAt}
            onClick={() =>
              act.mutate({
                action: "callback",
                callbackAt: new Date(callbackAt).toISOString(),
                note: note || undefined,
              })
            }
          >
            Set callback
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPanel(null)}>Cancel</Button>
        </ActionPanel>
      )}
      {panel === "dq" && (
        <ActionPanel>
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
        </ActionPanel>
      )}

      {/* Action row */}
      {panel === null && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setPanel("contact")} className="gap-1.5">
            <Check className="size-4" /> Contacted
          </Button>
          <Button size="sm" disabled={busy} onClick={() => setPanel("book")} className="gap-1.5 bg-success text-success-foreground hover:bg-success/90">
            <CalendarPlus className="size-4" /> Book
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setPanel("callback")} className="gap-1.5">
            <CalendarClock className="size-4" /> Callback
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setPanel("dq")} className="gap-1.5">
            <CircleX className="size-4" /> Disqualify
          </Button>
          <div className="relative ml-auto">
            <Button size="sm" variant="ghost" aria-label="More" onClick={() => setShowMore((v) => !v)}>
              <Ellipsis className="size-4" />
            </Button>
            {showMore && (
              <div className="absolute right-0 z-10 mt-1 w-48 rounded-md border bg-background p-1 shadow-lg" onMouseLeave={() => setShowMore(false)}>
                <MenuItem
                  onClick={() => {
                    setShowMore(false);
                    const text = prompt(`Add a note on ${lead.name}:`);
                    if (text?.trim()) act.mutate({ action: "note", note: text });
                  }}
                  icon={MessageSquarePlus}
                >
                  Add note
                </MenuItem>
                <MenuItem
                  onClick={() => { setShowMore(false); act.mutate({ action: "reschedule" }); }}
                  icon={RotateCcw}
                >
                  Mark reschedule
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setShowMore(false);
                    if (confirm(`Abandon ${lead.name}? They'll drop out of the queue.`)) act.mutate({ action: "abandon" });
                  }}
                  icon={Ban}
                >
                  Abandon
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

function ActionPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md border bg-muted/30 p-3">
      {children}
    </div>
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

/** Deep link to the lead's contact in GoHighLevel — where ALL customer
 *  communication happens (house rule). Renders nothing when the contact isn't
 *  linked to GHL (or GHL isn't configured server-side). */
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

function BookedRow({ lead }: { lead: Lead }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [apptAt, setApptAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  const act = useMutation({
    mutationFn: (body: Record<string, unknown>) => leadAction(lead.id, body),
    onSuccess: () => {
      setError(null);
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["leads", "recent"] });
      qc.invalidateQueries({ queryKey: ["leads", "queue"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Action failed"),
  });

  return (
    <div className="px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">{lead.name}</span>
          <GhlLink url={lead.ghlUrl} />
        </div>
        <span className="text-xs text-muted-foreground">
          {lead.appointmentAt
            ? fmtWhen(lead.appointmentAt)
            : lead.bookedAt
              ? `booked ${lead.bookedAt.slice(0, 10)}`
              : ""}
        </span>
      </div>
      <div className="mt-0.5 text-sm text-muted-foreground">
        {[lead.phone, lead.source].filter(Boolean).join(" · ")}
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}

      {editing ? (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor={`edit-appt-${lead.id}`} className="text-xs">New appointment time</Label>
            <Input
              id={`edit-appt-${lead.id}`}
              type="datetime-local"
              value={apptAt}
              onChange={(e) => setApptAt(e.target.value)}
              className="h-9 w-56"
            />
          </div>
          <Button
            size="sm"
            disabled={act.isPending || !apptAt}
            onClick={() => act.mutate({ action: "setAppointment", appointmentAt: new Date(apptAt).toISOString() })}
          >
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" /> Fix time
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={act.isPending}
            onClick={() => {
              if (confirm(`Put ${lead.name} back in the work queue? Use this if the booking fell through.`))
                act.mutate({ action: "reopen" });
            }}
          >
            <RotateCcw className="size-3.5" /> Reopen
          </Button>
        </div>
      )}
    </div>
  );
}

function BookedTab() {
  const q = useQuery({ queryKey: ["leads", "recent"], queryFn: () => getJson<{ leads: Lead[] }>("/api/leads/recent") });
  const leads = q.data?.leads ?? [];

  if (q.isLoading) return <Loading label="Loading booked leads…" />;
  if (q.error) return <ErrorBox error={q.error} />;
  if (leads.length === 0)
    return <Empty icon={CalendarPlus} title="No recent bookings" body="Appointments booked in the last two weeks show here. Older ones are under Find." />;

  return (
    <div className="divide-y">
      {leads.map((l) => (
        <BookedRow key={l.id} lead={l} />
      ))}
    </div>
  );
}

/* ---- Find (search all statuses) ------------------------------------------ */

function FindTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [submittedQ, setSubmittedQ] = useState("");

  const search = useQuery({
    queryKey: ["leads", "search", submittedQ],
    queryFn: () => getJson<{ leads: Lead[] }>(`/api/leads/search?q=${encodeURIComponent(submittedQ)}`),
    enabled: submittedQ.trim().length >= 2,
  });

  const reopen = useMutation({
    mutationFn: (id: string) => leadAction(id, { action: "reopen" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads", "search", submittedQ] });
      qc.invalidateQueries({ queryKey: ["leads", "queue"] });
    },
  });

  const leads = search.data?.leads ?? [];

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <p className="max-w-prose text-sm text-muted-foreground">
        Search every lead — open, booked, disqualified, or abandoned — to correct
        it or bring it back into the queue.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmittedQ(q);
        }}
      >
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, email, or phone…"
            className="h-10 pl-9"
          />
        </div>
        <Button type="submit" disabled={q.trim().length < 2}>Search</Button>
      </form>

      {search.isFetching && <Loading label="Searching…" />}
      {search.error && <ErrorBox error={search.error} />}
      {reopen.error && <ErrorBox error={reopen.error} />}
      {submittedQ && search.data && leads.length === 0 && !search.isFetching && (
        <p className="text-sm text-muted-foreground">No leads match “{submittedQ}”.</p>
      )}

      {leads.length > 0 && (
        <ul className="divide-y rounded-md border">
          {leads.map((l) => {
            const closed = l.status === "Disqualified" || l.status === "Abandoned";
            return (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{l.name}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs",
                        l.status === "Booked" && "bg-success/15 text-success",
                        closed && "bg-muted text-muted-foreground",
                        (l.status === "Open" || l.status === "Reschedule Needed") && "bg-warning/15 text-warning",
                      )}
                    >
                      {l.status === "Open" || l.status === "Reschedule Needed" ? "In queue" : l.status}
                      {l.status === "Disqualified" && l.disqualifyReason ? ` · ${l.disqualifyReason}` : ""}
                    </span>
                    <GhlLink url={l.ghlUrl} />
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {[l.phone, l.email, l.source, l.createdAt?.slice(0, 10)].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {(closed || l.status === "Booked") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={reopen.isPending}
                    onClick={() => {
                      if (confirm(`Put ${l.name} back in the work queue?`)) reopen.mutate(l.id);
                    }}
                  >
                    <RotateCcw className="size-3.5" /> Reopen
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
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
