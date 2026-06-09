/** Display helpers for money/percent. Client-safe (no server imports). */

export function formatCurrency(n: number | undefined | null): string {
  if (n === undefined || n === null) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function formatPercent(n: number | undefined | null): string {
  if (n === undefined || n === null) return "—";
  // Airtable percent formulas round-trip as a fraction (0.42 = 42%).
  return `${(n * 100).toFixed(1)}%`;
}
