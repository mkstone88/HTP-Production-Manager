"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CustomerPicker, type CustomerSelection } from "@/components/jobs/customer-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  JobStatus,
  ProjectType,
  type Job,
  type Sub,
} from "@/lib/airtable/types";

const projectTypes = ProjectType.options;
const statuses = JobStatus.options;

async function fetchSubs(): Promise<Sub[]> {
  const res = await fetch("/api/subs", { cache: "no-store" });
  const data = (await res.json()) as { subs?: Sub[]; error?: string };
  if (!res.ok || !data.subs) throw new Error(data.error || "Failed to load subs");
  return data.subs;
}

export function JobForm() {
  const router = useRouter();
  const qc = useQueryClient();

  const [customer, setCustomer] = useState<CustomerSelection>(null);
  const [jobNumber, setJobNumber] = useState("");
  const [projectType, setProjectType] = useState<typeof projectTypes[number]>("Interior");
  const [status, setStatus] = useState<typeof statuses[number]>("Proposal Accepted");
  const [assignedSubId, setAssignedSubId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const subsQuery = useQuery({ queryKey: ["subs"], queryFn: fetchSubs });

  const save = useMutation({
    mutationFn: async (): Promise<Job> => {
      const body: Record<string, unknown> = {
        jobNumber,
        projectType,
        status,
      };
      if (customer?.kind === "existing") body.customerId = customer.contact.id;
      if (customer?.kind === "new") body.newContact = customer.data;
      if (assignedSubId) body.assignedSubId = assignedSubId;
      if (notes.trim()) body.notes = notes.trim();

      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { job?: Job; error?: string };
      if (!res.ok || !data.job) throw new Error(data.error || "Save failed");
      return data.job;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      router.push("/schedule");
      router.refresh();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Save failed"),
  });

  const canSave = Boolean(customer) && jobNumber.trim() && projectType;

  return (
    <form
      className="grid max-w-xl gap-5 p-4 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid gap-2">
        <Label>Customer</Label>
        <CustomerPicker value={customer} onChange={setCustomer} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="jobNumber">Job number</Label>
          <Input
            id="jobNumber"
            value={jobNumber}
            onChange={(e) => setJobNumber(e.target.value)}
            placeholder="e.g. 2026-042"
            className="h-11"
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="projectType">Project type</Label>
          <select
            id="projectType"
            value={projectType}
            onChange={(e) => setProjectType(e.target.value as typeof projectTypes[number])}
            className="h-11 rounded-md border border-input bg-card px-3 text-sm"
            required
          >
            {projectTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof statuses[number])}
            className="h-11 rounded-md border border-input bg-card px-3 text-sm"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="crew">Crew leader</Label>
          <select
            id="crew"
            value={assignedSubId}
            onChange={(e) => setAssignedSubId(e.target.value)}
            className="h-11 rounded-md border border-input bg-card px-3 text-sm"
          >
            <option value="">Unassigned</option>
            {(subsQuery.data ?? [])
              .filter((s) => s.status === "Active" || s.status === "Onboarding")
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="rounded-md border border-input bg-card px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t bg-card/95 p-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <Button
          type="submit"
          disabled={!canSave || save.isPending}
          className="h-12 flex-1 sm:h-11 sm:flex-none"
        >
          {save.isPending ? "Saving…" : "Create job"}
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
