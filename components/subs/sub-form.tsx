"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubStatus, type Sub } from "@/lib/airtable/types";
import { SUB_COLOR_PALETTE } from "@/lib/sub-color";
import { cn } from "@/lib/utils";

const statuses = SubStatus.options;

type Props =
  | { mode: "create"; initial?: undefined }
  | { mode: "edit"; initial: Sub };

export function SubForm(props: Props) {
  const router = useRouter();
  const qc = useQueryClient();

  const [name, setName] = useState(props.initial?.name ?? "");
  const [contactName, setContactName] = useState(props.initial?.contactName ?? "");
  const [phone, setPhone] = useState(props.initial?.phone ?? "");
  const [email, setEmail] = useState(props.initial?.email ?? "");
  const [status, setStatus] = useState<typeof statuses[number]>(
    props.initial?.status ?? "Onboarding",
  );
  const [color, setColor] = useState<string>(props.initial?.color ?? "");
  const [notes, setNotes] = useState(props.initial?.notes ?? "");
  const [insuranceExpiration, setInsuranceExpiration] = useState(
    props.initial?.insuranceExpiration ?? "",
  );
  const [workersCompExpiration, setWorkersCompExpiration] = useState(
    props.initial?.workersCompExpiration ?? "",
  );
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async (): Promise<Sub> => {
      const body = {
        name,
        contactName,
        phone,
        email,
        status,
        color: color || (props.mode === "edit" ? null : undefined),
        notes,
        insuranceExpiration:
          insuranceExpiration || (props.mode === "edit" ? null : undefined),
        workersCompExpiration:
          workersCompExpiration || (props.mode === "edit" ? null : undefined),
      };
      const url = props.mode === "edit" ? `/api/subs/${props.initial.id}` : "/api/subs";
      const method = props.mode === "edit" ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { sub?: Sub; error?: string };
      if (!res.ok || !data.sub) throw new Error(data.error || "Save failed");
      return data.sub;
    },
    onSuccess: (sub) => {
      qc.invalidateQueries({ queryKey: ["subs"] });
      qc.invalidateQueries({ queryKey: ["subs", "active"] });
      qc.invalidateQueries({ queryKey: ["sub", sub.id] });
      router.push("/subs");
      router.refresh();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Save failed"),
  });

  return (
    <form
      className="grid max-w-xl gap-5 p-4 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="name">Company name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-11"
          required
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="contact">Contact name</Label>
          <Input
            id="contact"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof statuses[number])}
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="insuranceExpiration">Insurance expires</Label>
          <Input
            id="insuranceExpiration"
            type="date"
            value={insuranceExpiration}
            onChange={(e) => setInsuranceExpiration(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="workersCompExpiration">Worker&rsquo;s comp expires</Label>
          <Input
            id="workersCompExpiration"
            type="date"
            value={workersCompExpiration}
            onChange={(e) => setWorkersCompExpiration(e.target.value)}
            className="h-11"
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label>Calendar color</Label>
        <div className="flex flex-wrap items-center gap-2">
          {SUB_COLOR_PALETTE.map((c) => {
            const selected = color.toLowerCase() === c.toLowerCase();
            return (
              <button
                key={c}
                type="button"
                aria-label={`Use color ${c}`}
                aria-pressed={selected}
                onClick={() => setColor(c)}
                className={cn(
                  "size-8 rounded-full border-2 transition-transform",
                  selected
                    ? "border-foreground scale-110"
                    : "border-transparent hover:scale-105",
                )}
                style={{ backgroundColor: c }}
              />
            );
          })}
          <button
            type="button"
            onClick={() => setColor("")}
            className={cn(
              "ml-1 h-8 rounded-md border px-3 text-xs",
              color === ""
                ? "border-foreground bg-muted"
                : "border-input text-muted-foreground hover:bg-muted/40",
            )}
          >
            Auto
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Used to tint this sub&rsquo;s jobs on the schedule. &ldquo;Auto&rdquo;
          picks a stable color from their record ID.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t bg-background/95 p-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <Button
          type="submit"
          disabled={save.isPending || !name}
          className="h-12 flex-1 sm:h-11 sm:flex-none"
        >
          {save.isPending ? "Saving…" : props.mode === "edit" ? "Save changes" : "Create"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          className="h-12 sm:h-11"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
