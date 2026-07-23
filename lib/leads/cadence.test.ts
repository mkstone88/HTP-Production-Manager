import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GAP_DAYS,
  MAX_ATTEMPTS,
  computeNextFollowUp,
  daysSince,
  isDue,
  queueState,
} from "./cadence";

const NOW = new Date("2026-07-23T15:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("computeNextFollowUp", () => {
  it("is due immediately for a never-touched lead", () => {
    expect(computeNextFollowUp(0)).toBe(NOW.toISOString());
  });

  it("schedules each gap relative to the anchor", () => {
    const anchor = "2026-07-23T15:00:00.000Z";
    expect(computeNextFollowUp(1, anchor)).toBe("2026-07-24T15:00:00.000Z");
    expect(computeNextFollowUp(4, anchor)).toBe("2026-07-25T15:00:00.000Z"); // gap 2d
  });

  it("anchors to now when no anchor is given", () => {
    expect(computeNextFollowUp(1)).toBe(
      new Date(NOW.getTime() + GAP_DAYS[0] * 86_400_000).toISOString(),
    );
  });

  it("exhausts after the final gap", () => {
    expect(computeNextFollowUp(MAX_ATTEMPTS)).not.toBeNull();
    expect(computeNextFollowUp(MAX_ATTEMPTS + 1)).toBeNull();
  });

  it("falls back to now on an unparseable anchor", () => {
    expect(computeNextFollowUp(1, "garbage")).toBe(
      new Date(NOW.getTime() + GAP_DAYS[0] * 86_400_000).toISOString(),
    );
  });
});

describe("daysSince / isDue", () => {
  it("computes whole days since", () => {
    expect(daysSince("2026-07-20T15:00:00Z")).toBe(3);
    expect(daysSince(undefined)).toBeNull();
    expect(daysSince("nope")).toBeNull();
  });

  it("isDue treats past and empty as due, future as not", () => {
    expect(isDue("2026-07-23T14:59:00Z")).toBe(true);
    expect(isDue("2026-07-23T15:01:00Z")).toBe(false);
    expect(isDue(undefined)).toBe(true);
    expect(isDue("nope")).toBe(true);
  });
});

describe("queueState", () => {
  it("brand-new lead → new", () => {
    expect(queueState({ contactAttempts: 0 })).toBe("new");
  });

  it("callback overrides cadence: waiting until it arrives, then callback", () => {
    const lead = { contactAttempts: 2, firstContactedAt: "2026-07-20T00:00:00Z" };
    expect(queueState({ ...lead, callbackAt: "2026-07-24T00:00:00Z" })).toBe("waiting");
    expect(queueState({ ...lead, callbackAt: "2026-07-23T00:00:00Z" })).toBe("callback");
  });

  it("exhausted cadence → decision", () => {
    expect(
      queueState({
        contactAttempts: MAX_ATTEMPTS,
        firstContactedAt: "2026-07-01T00:00:00Z",
      }),
    ).toBe("decision");
  });

  it("due vs waiting follows nextFollowUpDate", () => {
    const lead = { contactAttempts: 2, firstContactedAt: "2026-07-20T00:00:00Z" };
    expect(queueState({ ...lead, nextFollowUpDate: "2026-07-22T00:00:00Z" })).toBe("due");
    expect(queueState({ ...lead, nextFollowUpDate: "2026-07-25T00:00:00Z" })).toBe("waiting");
  });
});
