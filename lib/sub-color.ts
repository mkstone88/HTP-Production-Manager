/**
 * Calendar-friendly palette for subcontractor colors. Hand-picked for legible
 * contrast against white event text in the schedule view.
 */
export const SUB_COLOR_PALETTE = [
  "#0e3f86", // brand blue
  "#1d4ed8", // blue-700
  "#0891b2", // cyan-600
  "#0d9488", // teal-600
  "#16a34a", // green-600
  "#65a30d", // lime-600
  "#ca8a04", // yellow-600
  "#ea580c", // orange-600
  "#dc2626", // red-600
  "#db2777", // pink-600
  "#9333ea", // purple-600
  "#52525b", // zinc-600
] as const;

/**
 * Deterministic per-sub fallback color when no override is set. Stable for a
 * given sub ID so events stay the same color across reloads.
 */
function hashedHue(subId: string): number {
  let h = 0;
  for (let i = 0; i < subId.length; i++) {
    h = (h * 31 + subId.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

export function subColor(opts: {
  subId: string | undefined;
  override?: string;
  completed?: boolean;
  onHold?: boolean;
}): string {
  if (opts.completed) return "#d4d4d8"; // zinc-300
  if (opts.onHold) return "#e2e8f0"; // slate-200, muted paused look
  if (!opts.subId) return "#0e3f86"; // brand blue when unassigned
  if (opts.override && /^#[0-9a-fA-F]{6}$/.test(opts.override)) return opts.override;
  return `oklch(0.5 0.16 ${hashedHue(opts.subId)})`;
}
