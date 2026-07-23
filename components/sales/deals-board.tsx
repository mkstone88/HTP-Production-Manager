"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  CalendarClock,
  ChevronRight,
  CircleCheck,
  CircleX,
  ExternalLink,
  Handshake,
  Hourglass,
  Mail,
  MessageSquarePlus,
  Phone,
  Trophy,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DealRow } from "@/lib/airtable/types";
import { cn } from "@/lib/utils";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data as T;
}

async function dealAction(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/sales/deals/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Action failed");
  return data as { deal: DealRow };
}

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

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

export function DealsBoard() {
  const q = useQuery({
    queryKey: ["sales", "deals"],
    queryFn: () => getJson<{ deals: DealRow[] }>("/api/sales/deals"),
  });
  const deals = useMemo(() => q.data?.deals ?? [], [q.data]);
  const [estimator, setEstimator] = useState("All");

  const estimators = useMemo(
    () => [...new Set(deals.map((d) => d.estimator).filter(Boolean))].sort(),
    [deals],
  );
  const scoped = useMemo(
    () => deals.filter((d) => estimator === "All" || d.estimator === estimator),
    [deals, estimator],
  );
  // 90+ days without an outcome is a different job (backlog triage, not daily
  // follow-up) — those collapse into their own group so fresh work stays on top.
  const STALE_DAYS = 90;
  const needsAction = scoped.filter((d) => !d.waiting && (d.daysOut ?? 0) < STALE_DAYS);
  const stale = scoped.filter((d) => !d.waiting && (d.daysOut ?? 0) >= STALE_DAYS);
  const waiting = scoped.filter((d) => d.waiting);
  const totalOpen = scoped.reduce((sum, d) => sum + d.amount, 0);
  const [staleOpen, setStaleOpen] = useState(false);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b bg-card px-4 py-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Handshake className="size-6 text-primary" /> Open deals
        </h1>
        {scoped.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {scoped.length} pending · {money(totalOpen)}
          </span>
        )}
        {estimators.length > 1 && (
          <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-semibold">Estimator</span>
            <select
              value={estimator}
              onChange={(e) => setEstimator(e.target.value)}
              className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
            >
              <option value="All">All</option>
              {estimators.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </label>
        )}
      </div>

      {q.isLoading && <p className="p-4 text-sm text-muted-foreground sm:p-6">Loading deals…</p>}
      {q.error && (
        <div className="m-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {q.error instanceof Error ? q.error.message : "Something went wrong."}
        </div>
      )}

      {q.data && (
        <div className="space-y-6 p-4 sm:p-6">
          <section className="space-y-3">
            <div>
              <h2 className="font-semibold">Follow up</h2>
              <p className="text-sm text-muted-foreground">
                Proposals with no check-in scheduled — or whose check-in time has
                arrived. Stalest first: don&apos;t let these sit.
              </p>
            </div>
            {needsAction.length === 0 ? (
              <Card className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                <CircleCheck className="size-4 text-success" />
                Every open proposal has a scheduled check-in. Nothing to chase.
              </Card>
            ) : (
              needsAction.map((d) => <DealCard key={d.id} deal={d} />)
            )}
          </section>

          {waiting.length > 0 && (
            <section className="space-y-3">
              <div>
                <h2 className="flex items-center gap-1.5 font-semibold">
                  <Hourglass className="size-4 text-muted-foreground" /> Waiting
                </h2>
                <p className="text-sm text-muted-foreground">
                  Check-in scheduled. Each deal moves back up top when its time
                  arrives.
                </p>
              </div>
              {waiting.map((d) => <DealCard key={d.id} deal={d} />)}
            </section>
          )}

          {stale.length > 0 && (
            <section className="space-y-3">
              <button
                type="button"
                onClick={() => setStaleOpen((v) => !v)}
                aria-expanded={staleOpen}
                className="flex items-center gap-1.5 font-semibold"
              >
                <ChevronRight className={cn("size-4 transition-transform", staleOpen && "rotate-90")} />
                <Archive className="size-4 text-muted-foreground" />
                Stale — {stale.length} deal{stale.length === 1 ? "" : "s"} ·{" "}
                {money(stale.reduce((s, d) => s + d.amount, 0))}
              </button>
              {staleOpen && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Pending 90+ days. Work these down when there&apos;s time — mark
                    them lost, or schedule a check-in to revive one.
                  </p>
                  {stale.map((d) => <DealCard key={d.id} deal={d} />)}
                </>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

/** Days-out badge that escalates as a proposal goes stale. */
function AgeBadge({ days }: { days: number | null }) {
  if (days == null) return null;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        days >= 30 && "bg-destructive/15 text-destructive",
        days >= 14 && days < 30 && "bg-warning/15 text-warning",
        days < 14 && "bg-muted text-muted-foreground",
      )}
    >
      {days === 0 ? "sent today" : `${days}d out`}
    </span>
  );
}

function DealCard({ deal }: { deal: DealRow }) {
  const qc = useQueryClient();
  const [panel, setPanel] = useState<"followUp" | "note" | "won" | "lost" | null>(null);
  const [followUpAt, setFollowUpAt] = useState("");
  const [note, setNote] = useState("");
  const [wonAmount, setWonAmount] = useState(String(deal.amount || ""));
  const [lostReason, setLostReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);

  const act = useMutation({
    mutationFn: (body: Record<string, unknown>) => dealAction(deal.id, body),
    onSuccess: () => {
      setError(null);
      setPanel(null);
      setNote("");
      qc.invalidateQueries({ queryKey: ["sales", "deals"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Action failed"),
  });

  return (
    <Card className={cn("p-4", !deal.waiting && (deal.daysOut ?? 0) >= 14 && "border-warning/40")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{deal.name}</span>
            <span className="font-mono text-sm font-semibold">{money(deal.amount)}</span>
            <GhlLink url={deal.ghlUrl} />
          </div>
          {/* Display-only: calls/texts/emails happen inside GoHighLevel. */}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
            {deal.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3.5" /> {deal.phone}
              </span>
            )}
            {deal.email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="size-3.5" /> {deal.email}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {deal.sentDate && <span>sent {deal.sentDate}</span>}
            {deal.jobType && <Tag>{deal.jobType}</Tag>}
            {deal.source && <Tag>{deal.source}</Tag>}
            {deal.estimator && <Tag>{deal.estimator}</Tag>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <AgeBadge days={deal.daysOut} />
          {deal.waiting && deal.followUpAt && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarClock className="size-3.5" /> {fmtWhen(deal.followUpAt)}
            </span>
          )}
        </div>
      </div>

      {deal.notes && (
        <button
          type="button"
          onClick={() => setNotesOpen((v) => !v)}
          className={cn(
            "mt-2 w-full whitespace-pre-wrap text-left text-sm text-muted-foreground",
            !notesOpen && "line-clamp-2",
          )}
        >
          {deal.notes}
        </button>
      )}

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      {panel === "followUp" && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md border bg-muted/30 p-3">
          <div className="space-y-1">
            <Label htmlFor={`fu-${deal.id}`} className="text-xs">Check back in on</Label>
            <Input
              id={`fu-${deal.id}`}
              type="datetime-local"
              value={followUpAt}
              onChange={(e) => setFollowUpAt(e.target.value)}
              className="h-9 w-56"
            />
          </div>
          <Button
            size="sm"
            disabled={act.isPending || !followUpAt}
            onClick={() =>
              act.mutate({ action: "setFollowUp", followUpAt: new Date(followUpAt).toISOString() })
            }
          >
            Schedule
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPanel(null)}>Cancel</Button>
        </div>
      )}
      {panel === "note" && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md border bg-muted/30 p-3">
          <div className="min-w-0 flex-1 space-y-1">
            <Label htmlFor={`dn-${deal.id}`} className="text-xs">Note (saved with a date stamp)</Label>
            <Input
              id={`dn-${deal.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Left voicemail — she's deciding between us and one other bid…"
              className="h-9"
            />
          </div>
          <Button
            size="sm"
            disabled={act.isPending || !note.trim()}
            onClick={() => act.mutate({ action: "note", note })}
          >
            Save note
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPanel(null)}>Cancel</Button>
        </div>
      )}

      {panel === "won" && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md border bg-muted/30 p-3">
          <div className="space-y-1">
            <Label htmlFor={`won-${deal.id}`} className="text-xs">Accepted amount</Label>
            <Input
              id={`won-${deal.id}`}
              type="number"
              min="1"
              step="0.01"
              value={wonAmount}
              onChange={(e) => setWonAmount(e.target.value)}
              className="h-9 w-36"
            />
          </div>
          <Button
            size="sm"
            className="gap-1.5 bg-success text-success-foreground hover:bg-success/90"
            disabled={act.isPending || !(Number(wonAmount) > 0)}
            onClick={() => act.mutate({ action: "markWon", amount: Number(wonAmount) })}
          >
            <Trophy className="size-4" /> Confirm won
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPanel(null)}>Cancel</Button>
        </div>
      )}
      {panel === "lost" && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md border bg-muted/30 p-3">
          <div className="min-w-0 flex-1 space-y-1">
            <Label htmlFor={`lost-${deal.id}`} className="text-xs">Why did we lose it?</Label>
            <Input
              id={`lost-${deal.id}`}
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="Went with another bid / not doing the project…"
              className="h-9"
            />
          </div>
          <Button
            size="sm"
            variant="destructive"
            disabled={act.isPending || !lostReason.trim()}
            onClick={() => act.mutate({ action: "markLost", reason: lostReason })}
          >
            Confirm lost
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPanel(null)}>Cancel</Button>
        </div>
      )}

      {panel === null && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" disabled={act.isPending} onClick={() => setPanel("followUp")}>
            <CalendarClock className="size-4" />
            {deal.waiting ? "Change check-in" : "Schedule check-in"}
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" disabled={act.isPending} onClick={() => setPanel("note")}>
            <MessageSquarePlus className="size-4" /> Add note
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" disabled={act.isPending} onClick={() => setPanel("won")}>
            <Trophy className="size-4" /> Won
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" disabled={act.isPending} onClick={() => setPanel("lost")}>
            <CircleX className="size-4" /> Lost
          </Button>
          {deal.waiting && (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5"
              disabled={act.isPending}
              onClick={() => act.mutate({ action: "setFollowUp", followUpAt: null })}
            >
              <X className="size-4" /> Clear
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-muted px-2 py-0.5">{children}</span>;
}

/** Deep link to the contact in GoHighLevel — where all messages happen. */
function GhlLink({ url }: { url?: string }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="Open contact in GoHighLevel"
      className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <ExternalLink className="size-3.5" /> GHL
    </a>
  );
}
