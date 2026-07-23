"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EmailTemplate } from "@/lib/airtable/types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data as T;
}

export function SettingsPanel() {
  return (
    <div className="flex flex-1 flex-col bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <SlidersHorizontal className="size-6 text-primary" /> Settings
        </h1>
      </div>
      <div className="space-y-6 p-4 sm:p-6">
        <EmailTemplatesSection />
      </div>
    </div>
  );
}

/* ---- Email templates ------------------------------------------------------ */

function EmailTemplatesSection() {
  const q = useQuery({
    queryKey: ["templates"],
    queryFn: () => getJson<{ templates: EmailTemplate[] }>("/api/templates"),
  });
  const [adding, setAdding] = useState(false);
  const templates = q.data?.templates ?? [];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 font-semibold">
            <Mail className="size-4" /> Email templates
          </h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            The templated customer emails behind the triage &ldquo;Send
            email&rdquo; button. The dropdown there pre-selects the template
            matching the job&apos;s project type — add a template to add a type.
          </p>
        </div>
        <Button size="sm" className="ml-auto gap-1.5" onClick={() => setAdding((v) => !v)}>
          <Plus className="size-4" /> Add template
        </Button>
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {q.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {q.error instanceof Error ? q.error.message : "Something went wrong."}
        </div>
      )}

      {adding && <TemplateEditor onDone={() => setAdding(false)} />}

      {templates.map((t) => (
        <TemplateEditor key={t.id} template={t} />
      ))}
      {q.data && templates.length === 0 && !adding && (
        <Card className="p-6 text-sm text-muted-foreground">
          No templates yet — add one to get started.
        </Card>
      )}
    </section>
  );
}

function TemplateEditor({
  template,
  onDone,
}: {
  template?: EmailTemplate;
  onDone?: () => void;
}) {
  const qc = useQueryClient();
  const isNew = !template;
  const [open, setOpen] = useState(isNew);
  const [name, setName] = useState(template?.name ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(isNew ? "/api/templates" : `/api/templates/${template.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, subject, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed");
      return data;
    },
    onSuccess: () => {
      setError(null);
      setSaved(true);
      qc.invalidateQueries({ queryKey: ["templates"] });
      if (isNew) onDone?.();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Save failed"),
  });

  const del = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/templates/${template!.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json())?.error || "Delete failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
    onError: (e) => setError(e instanceof Error ? e.message : "Delete failed"),
  });

  if (!open && template) {
    return (
      <Card className="flex flex-wrap items-center gap-3 p-3">
        <div className="min-w-0 flex-1">
          <div className="font-medium">{template.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {template.subject || "(no subject)"}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Edit</Button>
      </Card>
    );
  }

  return (
    <Card className="space-y-3 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Template name (matched to project type)</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Interior" className="h-9" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Subject</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="h-9" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Body</Label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          className="w-full rounded-md border border-input bg-card px-3 py-2 font-mono text-sm"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={save.isPending || !name.trim()}
          onClick={() => { setSaved(false); save.mutate(); }}
        >
          {save.isPending ? "Saving…" : isNew ? "Add template" : "Save"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => (isNew ? onDone?.() : setOpen(false))}
        >
          {isNew ? "Cancel" : "Close"}
        </Button>
        {saved && <span className="text-xs text-success">Saved</span>}
        {!isNew && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto gap-1.5 text-destructive"
            disabled={del.isPending}
            onClick={() => {
              if (confirm(`Delete the "${template.name}" template?`)) del.mutate();
            }}
          >
            <Trash2 className="size-4" /> Delete
          </Button>
        )}
      </div>
    </Card>
  );
}
