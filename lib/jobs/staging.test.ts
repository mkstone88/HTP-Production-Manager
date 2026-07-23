import { describe, expect, it } from "vitest";

import type { Job } from "@/lib/airtable/types";
import { computeStaging } from "./staging";

const base: Job = {
  id: "rec1",
  name: "1001-Test Interior",
  jobNumber: "1001",
  status: "Proposal Accepted",
};

describe("computeStaging", () => {
  it("counts zero steps done on a bare job", () => {
    const s = computeStaging(base, { today: "2026-07-23" });
    expect(s.done).toBe(0);
    expect(s.total).toBe(6);
    expect(s.ready).toBe(false);
    expect(s.daysUntilStart).toBeUndefined();
    expect(s.needsAttention).toBe(false); // unscheduled jobs never flag
  });

  it("derives crewAssigned and scheduled from their source fields", () => {
    const s = computeStaging(
      { ...base, assignedSubId: "recSub", scheduledStart: "2026-08-20" },
      { today: "2026-07-23" },
    );
    expect(s.crewAssigned).toBe(true);
    expect(s.scheduled).toBe(true);
    expect(s.done).toBe(2);
  });

  it("is ready only when every step is complete", () => {
    const s = computeStaging(
      {
        ...base,
        emailSent: true,
        customerReplied: true,
        colorsReceived: true,
        workOrderReady: true,
        assignedSubId: "recSub",
        scheduledStart: "2026-08-20",
      },
      { today: "2026-07-23" },
    );
    expect(s.done).toBe(6);
    expect(s.ready).toBe(true);
    expect(s.needsAttention).toBe(false); // complete jobs never flag
  });

  it("computes daysUntilStart relative to the supplied today", () => {
    const s = computeStaging(
      { ...base, scheduledStart: "2026-07-30" },
      { today: "2026-07-23" },
    );
    expect(s.daysUntilStart).toBe(7);
  });

  it("flags needsAttention inside the window, not outside", () => {
    const soon = computeStaging(
      { ...base, scheduledStart: "2026-08-05" },
      { today: "2026-07-23" }, // 13 days out, default window 14
    );
    expect(soon.needsAttention).toBe(true);

    const far = computeStaging(
      { ...base, scheduledStart: "2026-08-07" },
      { today: "2026-07-23" }, // 15 days out
    );
    expect(far.needsAttention).toBe(false);
  });

  it("keeps flagging past-start incomplete jobs (negative daysUntilStart)", () => {
    const s = computeStaging(
      { ...base, scheduledStart: "2026-07-20" },
      { today: "2026-07-23" },
    );
    expect(s.daysUntilStart).toBe(-3);
    expect(s.needsAttention).toBe(true);
  });
});
