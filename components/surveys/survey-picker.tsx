"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ChevronRight, NotebookPen, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Card } from "@/components/ui/card";
import type { SurveyCandidate } from "@/lib/airtable/types";
import { cn } from "@/lib/utils";

async function fetchCandidates(q: string): Promise<SurveyCandidate[]> {
  const url = q ? `/api/surveys?q=${encodeURIComponent(q)}` : "/api/surveys";
  const res = await fetch(url, { cache: "no-store" });
  const data = (await res.json()) as { rows?: SurveyCandidate[]; error?: string };
  if (!res.ok || !data.rows) throw new Error(data.error || "Failed to load appointments");
  return data.rows;
}

function fmtAppt(iso?: string): string {
  if (!iso) return "no appointment time";
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

export function SurveyPicker() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState("");

  const query = useQuery({
    queryKey: ["surveys", "candidates", q],
    queryFn: () => fetchCandidates(q),
  });
  const rows = query.data ?? [];

  /** Tap a contact: resume their survey if it exists, else create and open it. */
  async function open(candidate: SurveyCandidate) {
    setError("");
    setOpening(candidate.opportunityId);
    try {
      if (candidate.surveyId) {
        router.push(`/surveys/${candidate.surveyId}`);
        return;
      }
      const res = await fetch("/api/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: candidate.opportunityId }),
      });
      const data = (await res.json()) as { survey?: { id: string }; error?: string };
      if (!res.ok || !data.survey) throw new Error(data.error || "Could not start survey");
      router.push(`/surveys/${data.survey.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start survey");
      setOpening(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <NotebookPen className="size-5" /> Project surveys
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick the appointment you&apos;re sitting in — answers save as you tap.
        </p>
      </div>

      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search any contact…"
          className="w-full rounded-md border border-input bg-background py-2.5 pl-9 pr-3 text-sm text-foreground"
        />
      </label>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!q && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <CalendarClock className="size-3.5" /> Up next — appointments without a
          survey, closest first
        </p>
      )}

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading appointments…</p>
      ) : query.error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {query.error instanceof Error ? query.error.message : "Failed to load."}
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {q ? "No contacts match that search." : "No upcoming appointments need a survey."}
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <button
              key={r.opportunityId}
              type="button"
              onClick={() => open(r)}
              disabled={opening !== null}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/40 disabled:opacity-60",
              )}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{r.name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {fmtAppt(r.appointmentAt)}
                  {r.jobType ? ` · ${r.jobType}` : ""}
                  {r.surveyId ? " · survey started" : ""}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">
                {opening === r.opportunityId
                  ? "Opening…"
                  : r.surveyId
                    ? "Resume"
                    : "Start survey"}
                <ChevronRight className="size-4" />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
