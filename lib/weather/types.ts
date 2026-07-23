import { z } from "zod";

/**
 * Weather is a non-Airtable domain: a read-only forecast overlay for the
 * Schedule calendar. Schemas here double as the contract for the
 * `/api/weather` endpoints (and any future agent tool).
 */

/** The kinds of conditions we flag as a concern for exterior work. */
export const WeatherConcernKind = z.enum(["rain", "heat", "cold", "wind"]);
export type WeatherConcernKind = z.infer<typeof WeatherConcernKind>;

/** One day of forecast, normalized to US units (°F, mph, %). */
export const DailyForecast = z.object({
  date: z.string(), // YYYY-MM-DD
  weatherCode: z.number().optional(), // WMO code, drives the condition icon
  tempMaxF: z.number().optional(),
  tempMinF: z.number().optional(),
  precipProbabilityPct: z.number().optional(),
  windSpeedMaxMph: z.number().optional(),
  windGustMaxMph: z.number().optional(),
  // Derived server-side from the thresholds in `risk.ts`:
  concerns: z.array(WeatherConcernKind),
  concernLabels: z.array(z.string()), // human-readable, e.g. "Rain 66%"
  hasConcern: z.boolean(),
});
export type DailyForecast = z.infer<typeof DailyForecast>;

export const WeatherLocation = z.object({
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
});
export type WeatherLocation = z.infer<typeof WeatherLocation>;

export const WeatherForecast = z.object({
  location: WeatherLocation,
  days: z.array(DailyForecast),
});
export type WeatherForecast = z.infer<typeof WeatherForecast>;
