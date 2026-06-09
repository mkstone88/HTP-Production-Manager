import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/airtable/errors";
import { JobsRepo } from "@/lib/airtable/jobs";
import type { Job } from "@/lib/airtable/types";
import {
  computeStaging,
  todayInBusinessTz,
  type StagingSummary,
} from "@/lib/jobs/staging";

export const dynamic = "force-dynamic";

export type TriageJob = Job & { staging: StagingSummary };

/**
 * Pre-job triage: every job still in the staging pipeline (Proposal Accepted or
 * Scheduled), with the staging checklist computed server-side. A job leaves
 * triage only once it advances to In Progress (or Completed / On Hold).
 *
 * Sorted so jobs with start dates come first (closest first), then by name.
 *
 * Future agent tool: "what jobs need follow-up before they can start?"
 */
export async function GET() {
  try {
    const today = todayInBusinessTz();
    const jobs = await JobsRepo.list({
      statuses: ["Proposal Accepted", "Scheduled"],
    });
    const triage: TriageJob[] = jobs
      .map((j) => ({ ...j, staging: computeStaging(j, { today }) }))
      .sort((a, b) => {
        const ad = a.scheduledStart ?? "";
        const bd = b.scheduledStart ?? "";
        if (ad && bd) return ad.localeCompare(bd);
        if (ad) return -1;
        if (bd) return 1;
        // Unscheduled jobs: oldest accepted first, so the list reads as a
        // work queue instead of an alphabetical pile.
        const aw = a.jobWonDate ?? "";
        const bw = b.jobWonDate ?? "";
        if (aw && bw && aw !== bw) return aw.localeCompare(bw);
        return a.name.localeCompare(b.name);
      });
    return NextResponse.json({ jobs: triage });
  } catch (err) {
    return errorResponse(err);
  }
}
