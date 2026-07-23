import { describe, expect, it } from "vitest";

import { centralDate, mondayOf } from "./scorecard";

describe("centralDate", () => {
  it("passes date-only strings through untouched", () => {
    expect(centralDate("2026-07-23")).toBe("2026-07-23");
  });

  it("converts UTC datetimes to the Central calendar day", () => {
    // 00:30 UTC on Jun 1 is 19:30 CDT on May 31 — the month boundary case
    // that UTC slicing gets wrong.
    expect(centralDate("2026-06-01T00:30:00Z")).toBe("2026-05-31");
    expect(centralDate("2026-06-01T06:30:00Z")).toBe("2026-06-01");
  });

  it("handles winter (CST, UTC-6) offsets too", () => {
    expect(centralDate("2026-01-15T05:30:00Z")).toBe("2026-01-14");
    expect(centralDate("2026-01-15T06:30:00Z")).toBe("2026-01-15");
  });

  it("returns empty for garbage", () => {
    expect(centralDate("")).toBe("");
    expect(centralDate("not-a-date")).toBe("");
  });
});

describe("mondayOf", () => {
  it("maps every day of a week to that week's Monday", () => {
    expect(mondayOf("2026-07-20")).toBe("2026-07-20"); // Monday
    expect(mondayOf("2026-07-23")).toBe("2026-07-20"); // Thursday
    expect(mondayOf("2026-07-26")).toBe("2026-07-20"); // Sunday
  });

  it("crosses month boundaries", () => {
    expect(mondayOf("2026-08-01")).toBe("2026-07-27"); // Saturday
  });
});
