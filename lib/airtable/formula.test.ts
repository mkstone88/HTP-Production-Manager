import { describe, expect, it } from "vitest";

import { escapeFormulaValue } from "./formula";

describe("escapeFormulaValue", () => {
  it("passes plain strings through", () => {
    expect(escapeFormulaValue("smith")).toBe("smith");
    expect(escapeFormulaValue("o brien & sons")).toBe("o brien & sons");
  });

  it("escapes single quotes", () => {
    expect(escapeFormulaValue("o'brien")).toBe("o\\'brien");
  });

  it("escapes backslashes BEFORE quotes (the trailing-backslash trap)", () => {
    // A trailing backslash must not be able to swallow the closing quote of
    // the formula literal: SEARCH('smith\', ...) is INVALID_FILTER_BY_FORMULA.
    expect(escapeFormulaValue("smith\\")).toBe("smith\\\\");
  });

  it("neutralizes the \\' injection payload", () => {
    // Input `\'` naively becomes `\\'` — a literal backslash then a LIVE
    // quote, terminating the string and injecting the remainder as formula
    // code. Correct escaping yields backslash + escaped quote.
    expect(escapeFormulaValue("\\', TRUE(), '")).toBe("\\\\\\', TRUE(), \\'");
  });

  it("supports double-quoted literals", () => {
    expect(escapeFormulaValue('a"b\\', '"')).toBe('a\\"b\\\\');
    // Single quotes are untouched in double-quote mode and vice versa.
    expect(escapeFormulaValue("o'brien", '"')).toBe("o'brien");
  });

  it("round-trips realistic customer input", () => {
    expect(escapeFormulaValue("D'Angelo O'Neil-Sanchez")).toBe(
      "D\\'Angelo O\\'Neil-Sanchez",
    );
  });
});
