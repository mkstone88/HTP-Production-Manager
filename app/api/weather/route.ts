import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/airtable/errors";
import { fetchForecast } from "@/lib/weather/open-meteo";

// The forecast changes slowly; let Next cache the upstream fetch (1h).
export const revalidate = 3600;

/**
 * GET /api/weather — metro daily forecast with per-day weather concerns
 * (rain / heat / cold / wind) derived server-side from the thresholds in
 * `lib/weather/risk.ts`. Drives the Schedule weather overlay.
 *
 * Future agent tool: "what's the weather looking like this week?"
 */
export async function GET() {
  try {
    const forecast = await fetchForecast();
    return NextResponse.json(forecast);
  } catch (err) {
    return errorResponse(err);
  }
}
