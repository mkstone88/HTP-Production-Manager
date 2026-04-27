"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Sub } from "@/lib/airtable/types";

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
  const [trade, setTrade] = useState(props.initial?.trade ?? "");
  const [active, setActive] = useState(props.initial?.active ?? true);
  const [notes, setNotes] = useState(props.initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async (): Promise<Sub> => {
      const body = { name, contactName, phone, email, trade, active, notes };
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
      className="grid max-w-xl gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="contact">Contact</Label>
          <Input id="contact" value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="trade">Trade</Label>
          <Input id="trade" value={trade} onChange={(e) => setTrade(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="size-4"
        />
        Active
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={save.isPending || !name}>
          {save.isPending ? "Saving…" : props.mode === "edit" ? "Save changes" : "Create"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
