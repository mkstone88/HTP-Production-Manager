import "server-only";

/**
 * Prepend a dated log line to an existing multiline notes value (newest first).
 * Shared by the setter queue (call notes) and the sales Deals board (check-in
 * notes) so both write the same log format to the opportunity's Notes field.
 */
export function prependNote(existing: unknown, note: string): string {
  const stamp = new Date().toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const prior =
    existing === undefined || existing === null || existing === ""
      ? ""
      : String(existing);
  return `[${stamp}] ${note.trim()}${prior ? `\n${prior}` : ""}`;
}
