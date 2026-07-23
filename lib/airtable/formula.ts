/**
 * Escaping for user-supplied strings interpolated into Airtable
 * `filterByFormula` string literals.
 *
 * Pure module (no server-only) so it's unit-testable and safe to import
 * anywhere. Backslash MUST be escaped before the quote: escaping only the
 * quote lets a trailing `\` swallow the closing quote (the whole request
 * fails with INVALID_FILTER_BY_FORMULA) and lets `\'` in the input turn into
 * `\\'` — a literal backslash followed by a LIVE quote that terminates the
 * string early and injects the rest of the input as formula code.
 */
export function escapeFormulaValue(v: string, quote: "'" | '"' = "'"): string {
  const escaped = v.replace(/\\/g, "\\\\");
  return quote === "'"
    ? escaped.replace(/'/g, "\\'")
    : escaped.replace(/"/g, '\\"');
}
