import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/airtable/errors";
import { JobsRepo } from "@/lib/airtable/jobs";
import { SubsRepo } from "@/lib/airtable/subs";

export const dynamic = "force-dynamic";

type ConflictJob = {
  id: string;
  name: string;
  scheduledStart: string;
  scheduledEnd: string;
};

export type CrewConflict = {
  subId: string;
  subName: string;
  jobs: [ConflictJob, ConflictJob];
  overlapStart: string;
  overlapEnd: string;
};

/**
 * Pairs of jobs assigned to the same crew with overlapping date ranges.
 * Completed and On Hold jobs are ignored. This is a heads-up, not an error:
 * a one-day overlap is often an intentional half-day handoff between jobs —
 * the point is to make it visible so it gets double-checked.
 *
 * Future agent tool: "is anyone double-booked next week?"
 */
export async function GET() {
  try {
    const [jobs, subs] = await Promise.all([JobsRepo.list(), SubsRepo.list()]);
    const subName = new Map(subs.map((s) => [s.id, s.name]));

    const schedulable = jobs.filter(
      (j) =>
        j.assignedSubId &&
        j.scheduledStart &&
        j.status !== "Completed" &&
        j.status !== "On Hold",
    );

    const bySub = new Map<string, typeof schedulable>();
    for (const j of schedulable) {
      const list = bySub.get(j.assignedSubId!) ?? [];
      list.push(j);
      bySub.set(j.assignedSubId!, list);
    }

    const conflicts: CrewConflict[] = [];
    for (const [subId, list] of bySub) {
      list.sort((a, b) => a.scheduledStart!.localeCompare(b.scheduledStart!));
      for (let i = 0; i < list.length; i++) {
        for (let k = i + 1; k < list.length; k++) {
          const a = list[i];
          const b = list[k];
          const aEnd = a.scheduledEnd ?? a.scheduledStart!;
          const bEnd = b.scheduledEnd ?? b.scheduledStart!;
          // Sorted by start, so b starts at or after a; dates are inclusive.
          if (b.scheduledStart! > aEnd) break;
          conflicts.push({
            subId,
            subName: subName.get(subId) ?? "Unknown crew",
            jobs: [
              {
                id: a.id,
                name: a.name || a.customerName || "Job",
                scheduledStart: a.scheduledStart!,
                scheduledEnd: aEnd,
              },
              {
                id: b.id,
                name: b.name || b.customerName || "Job",
                scheduledStart: b.scheduledStart!,
                scheduledEnd: bEnd,
              },
            ],
            overlapStart: b.scheduledStart!,
            overlapEnd: aEnd < bEnd ? aEnd : bEnd,
          });
        }
      }
    }

    conflicts.sort((a, b) => a.overlapStart.localeCompare(b.overlapStart));
    return NextResponse.json({ conflicts });
  } catch (err) {
    return errorResponse(err);
  }
}
