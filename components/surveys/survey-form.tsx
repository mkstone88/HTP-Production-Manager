"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, CloudUpload } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { Card } from "@/components/ui/card";
import type { SalesSurvey } from "@/lib/airtable/types";
import {
  CAREFUL_ITEMS,
  COLOR_CONSULTATION,
  COLORS_DECIDED,
  CONCERNS,
  DAMAGE_ISSUES,
  DISC_READS,
  HIRED_BEFORE,
  INTERIOR_SENSITIVITIES,
  MAIN_GOALS,
  OTHER_BIDS,
  OUTCOMES,
  PETS,
  PROJECT_TYPES,
  SURFACES_EXTERIOR,
  SURFACES_INTERIOR,
  TIMELINES,
  URGENCY_DRIVERS,
  WHAT_MATTERS,
} from "@/lib/surveys/questions";
import { cn } from "@/lib/utils";

/** Answer fields the form edits (everything except id/name/meta). */
type Answers = Omit<SalesSurvey, "id" | "name" | "opportunityId" | "surveyedBy" | "surveyedAt">;

async function fetchSurvey(id: string): Promise<SalesSurvey> {
  const res = await fetch(`/api/surveys/${id}`, { cache: "no-store" });
  const data = (await res.json()) as { survey?: SalesSurvey; error?: string };
  if (!res.ok || !data.survey) throw new Error(data.error || "Failed to load survey");
  return data.survey;
}

export function SurveyForm({ surveyId }: { surveyId: string }) {
  const query = useQuery({
    queryKey: ["surveys", surveyId],
    queryFn: () => fetchSurvey(surveyId),
  });

  const [answers, setAnswers] = useState<Answers>({});
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [saveError, setSaveError] = useState("");
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Prefill once per survey (derived-state-during-render; a background refetch
  // never clobbers what's being typed).
  if (query.data && loadedId !== query.data.id) {
    setLoadedId(query.data.id);
    const meta = new Set(["id", "name", "opportunityId", "surveyedBy", "surveyedAt"]);
    setAnswers(
      Object.fromEntries(
        Object.entries(query.data).filter(([k]) => !meta.has(k)),
      ) as Answers,
    );
  }

  /** PATCH one field now. null clears it in Airtable. */
  function persist(key: keyof Answers, value: unknown) {
    setPending((n) => n + 1);
    fetch(`/api/surveys/${surveyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value ?? null }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error || "Save failed");
        }
        setSaveError("");
      })
      .catch((e) => setSaveError(e instanceof Error ? e.message : "Save failed"))
      .finally(() => setPending((n) => n - 1));
  }

  /** Taps save immediately; typed text debounces so we don't PATCH per keystroke. */
  function setField(key: keyof Answers, value: unknown, debounceMs = 0) {
    setAnswers((a) => ({ ...a, [key]: value ?? undefined }));
    if (timers.current[key]) clearTimeout(timers.current[key]);
    if (debounceMs > 0) {
      timers.current[key] = setTimeout(() => persist(key, value), debounceMs);
    } else {
      persist(key, value);
    }
  }

  if (query.isLoading) {
    return <p className="p-4 text-sm text-muted-foreground">Loading survey…</p>;
  }
  if (query.error || !query.data) {
    return (
      <div className="m-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        {query.error instanceof Error ? query.error.message : "Failed to load survey."}
      </div>
    );
  }

  const type = answers.projectType;
  const showInterior = type === "Interior" || type === "Both" || !type;
  const showExterior = type === "Exterior" || type === "Both" || !type;
  const surfaceChips = [
    ...(showInterior ? SURFACES_INTERIOR : []),
    ...(showExterior ? SURFACES_EXTERIOR.filter((s) => s !== "Doors" || !showInterior) : []),
    "Other",
  ];
  const carefulChips = CAREFUL_ITEMS.filter(
    (c) => c !== "Fragile Landscaping" || showExterior,
  );

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4 pb-24 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href="/surveys"
            className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Surveys
          </Link>
          <h1 className="text-lg font-semibold leading-tight">{query.data.name}</h1>
        </div>
        <span
          className={cn(
            "mt-1 inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium",
            saveError
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : pending > 0
                ? "border-border text-muted-foreground"
                : "border-success/40 bg-success/10 text-success",
          )}
        >
          {saveError ? (
            "Save failed — retrying on next change"
          ) : pending > 0 ? (
            <>
              <CloudUpload className="size-3.5" /> Saving…
            </>
          ) : (
            <>
              <Check className="size-3.5" /> Saved
            </>
          )}
        </span>
      </div>

      <Section title="Setup">
        <Question label="Project type">
          <SingleChips
            options={PROJECT_TYPES}
            value={answers.projectType}
            onChange={(v) => setField("projectType", v)}
          />
        </Question>
        <Question label="DISC read" hint="Your rapport-step personality read">
          <SingleChips
            options={DISC_READS}
            value={answers.discRead}
            onChange={(v) => setField("discRead", v)}
          />
        </Question>
      </Section>

      <Section title="Project details">
        <Question label="1 · What would you like to paint?">
          <TextBox
            value={answers.projectDescription}
            onChange={(v) => setField("projectDescription", v, 800)}
            rows={3}
          />
        </Question>
        <Question label="2 · Which surfaces are we addressing?">
          <MultiChips
            options={surfaceChips}
            value={answers.surfaces}
            onChange={(v) => setField("surfaces", v)}
          />
          {answers.surfaces?.includes("Other") && (
            <TextLine
              placeholder="Other surfaces…"
              value={answers.surfacesOther}
              onChange={(v) => setField("surfacesOther", v, 800)}
            />
          )}
        </Question>
        <Question label="3 · Any damage or repair issues to look at?">
          <MultiChips
            options={DAMAGE_ISSUES}
            value={answers.damageIssues}
            onChange={(v) => setField("damageIssues", v)}
          />
          <TextLine
            placeholder="Damage notes…"
            value={answers.damageNotes}
            onChange={(v) => setField("damageNotes", v, 800)}
          />
        </Question>
        <Question label="4 · Have you thought about colors?">
          <SingleChips
            options={COLORS_DECIDED}
            value={answers.colorsDecided}
            onChange={(v) => setField("colorsDecided", v)}
          />
        </Question>
        <Question label="4a · Interested in a color consultation?">
          <SingleChips
            options={COLOR_CONSULTATION}
            value={answers.colorConsultation}
            onChange={(v) => setField("colorConsultation", v)}
          />
        </Question>
        <Question label="5 · Timeline for completion?">
          <SingleChips
            options={TIMELINES}
            value={answers.timeline}
            onChange={(v) => setField("timeline", v)}
          />
        </Question>
        <Question label="5a · Anything coming up that makes this important?">
          <MultiChips
            options={URGENCY_DRIVERS}
            value={answers.urgencyDrivers}
            onChange={(v) => setField("urgencyDrivers", v)}
          />
          <TextLine
            placeholder="Details…"
            value={answers.urgencyNotes}
            onChange={(v) => setField("urgencyNotes", v, 800)}
          />
        </Question>
        <Question label="6 · Main goal for this project?">
          <MultiChips
            options={MAIN_GOALS}
            value={answers.mainGoals}
            onChange={(v) => setField("mainGoals", v)}
          />
        </Question>
        <Question label="6a · What happens if it doesn't get done this year?" hint="Capture their words — this is the why">
          <TextBox
            value={answers.stakesIfNotDone}
            onChange={(v) => setField("stakesIfNotDone", v, 800)}
            rows={2}
          />
        </Question>
      </Section>

      <Section title="Contractor preferences">
        <Question label="7 · Have other painters looked at the project?">
          <SingleChips
            options={OTHER_BIDS}
            value={answers.otherBids}
            onChange={(v) => setField("otherBids", v)}
          />
        </Question>
        <Question label="7a · Any reason you didn't move forward with them?">
          <TextBox
            value={answers.whyNotOthers}
            onChange={(v) => setField("whyNotOthers", v, 800)}
            rows={2}
          />
        </Question>
        <Question label="8 · Ever hired a painting company before?">
          <SingleChips
            options={HIRED_BEFORE}
            value={answers.hiredBefore}
            onChange={(v) => setField("hiredBefore", v)}
          />
        </Question>
        <Question label="8a · How did it go? / questions about the process">
          <TextBox
            value={answers.pastExperienceNotes}
            onChange={(v) => setField("pastExperienceNotes", v, 800)}
            rows={2}
          />
        </Question>
        <Question label="9 · Biggest concerns about hiring a painter?">
          <MultiChips
            options={CONCERNS}
            value={answers.concerns}
            onChange={(v) => setField("concerns", v)}
          />
        </Question>
        <Question label="10 · What's important about the company you hire?">
          <MultiChips
            options={WHAT_MATTERS}
            value={answers.whatMatters}
            onChange={(v) => setField("whatMatters", v)}
          />
        </Question>
        <Question label="11 · What did you hope to learn about us?">
          <TextBox
            value={answers.wantsToLearn}
            onChange={(v) => setField("wantsToLearn", v, 800)}
            rows={2}
          />
        </Question>
      </Section>

      <Section title="Logistics">
        {showInterior && (
          <Question label="Sensitivities to paint smells, dust, or chemicals?">
            <MultiChips
              options={INTERIOR_SENSITIVITIES}
              value={answers.interiorSensitivities}
              onChange={(v) => setField("interiorSensitivities", v)}
            />
          </Question>
        )}
        <Question label="12 · Pets in the home?">
          <MultiChips
            options={PETS}
            value={answers.pets}
            onChange={(v) => setField("pets", v)}
          />
          <TextLine
            placeholder="Special considerations…"
            value={answers.petNotes}
            onChange={(v) => setField("petNotes", v, 800)}
          />
        </Question>
        <Question label="13 · Areas or items to be careful with?">
          <MultiChips
            options={carefulChips}
            value={answers.carefulItems}
            onChange={(v) => setField("carefulItems", v)}
          />
          <TextLine
            placeholder="Details…"
            value={answers.carefulItemsNotes}
            onChange={(v) => setField("carefulItemsNotes", v, 800)}
          />
        </Question>
      </Section>

      <Section title="Walkthrough & wrap-up">
        <Question label="Scope / walkthrough notes">
          <TextBox
            value={answers.walkthroughNotes}
            onChange={(v) => setField("walkthroughNotes", v, 800)}
            rows={4}
          />
        </Question>
        <Question label="Outcome">
          <SingleChips
            options={OUTCOMES}
            value={answers.outcome}
            onChange={(v) => setField("outcome", v)}
          />
        </Question>
        <Question
          label="Next follow-up"
          hint="Also schedules the deal on the Deals board"
        >
          <input
            type="datetime-local"
            value={toLocalInput(answers.nextFollowUpAt)}
            onChange={(e) => {
              const iso = e.target.value ? new Date(e.target.value).toISOString() : null;
              setField("nextFollowUpAt", iso);
            }}
            className="rounded-md border border-input bg-card px-2 py-2 text-sm text-foreground"
          />
        </Question>
      </Section>
    </div>
  );
}

function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ------------------------------- primitives ------------------------------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-5 p-4 sm:p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </Card>
  );
}

function Question({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium leading-snug">
        {label}
        {hint && (
          <span className="ml-2 text-xs font-normal text-muted-foreground">{hint}</span>
        )}
      </p>
      {children}
    </div>
  );
}

function chipClass(active: boolean): string {
  return cn(
    "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-card text-muted-foreground hover:bg-muted",
  );
}

/** Tap to toggle several. */
function MultiChips({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value?: string[];
  onChange: (v: string[]) => void;
}) {
  const selected = value ?? [];
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() =>
              onChange(active ? selected.filter((s) => s !== o) : [...selected, o])
            }
            className={chipClass(active)}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

/** Tap to pick one; tap again to clear (answers are never mandatory). */
function SingleChips({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value?: string;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(value === o ? null : o)}
          className={chipClass(value === o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function TextBox({
  value,
  onChange,
  rows,
}: {
  value?: string;
  onChange: (v: string) => void;
  rows: number;
}) {
  return (
    <textarea
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground"
    />
  );
}

function TextLine({
  value,
  onChange,
  placeholder,
}: {
  value?: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="text"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="mt-1.5 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground"
    />
  );
}
