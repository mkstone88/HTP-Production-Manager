import type { ProjectType } from "@/lib/airtable/types";

import type { DailyForecast, WeatherConcernKind } from "./types";

/**
 * The single source of truth for "is this weather a problem for exterior work?".
 * Pure + dependency-free so it can run on the server (API routes) and the client
 * (calendar overlay) alike. Tune the numbers here; nothing else hard-codes them.
 *
 * Defaults reflect exterior painting realities in the OKC metro:
 *  - paint/stain won't cure in the rain or in the cold,
 *  - extreme heat flashes the surface before it can level,
 *  - high wind kicks up overspray and makes ladders unsafe.
 */
export const WEATHER_THRESHOLDS = {
  precipProbabilityPct: 50, // >= → rain concern
  tempMaxF: 95, // > → too hot
  tempMinF: 40, // < → too cold
  windSustainedMph: 20, // >= → wind concern
  windGustMph: 30, // >= → wind concern
} as const;

/**
 * Show the rain chip (informational, not yet a concern) once the chance reaches
 * this, so the PM sees a building threat before it crosses the concern line.
 */
export const RAIN_DISPLAY_PCT = 20;

/**
 * Project types that happen outdoors and are therefore weather-exposed. Interior
 * / Cabinets / (interior) Staining are unaffected, so they never turn red.
 */
const EXTERIOR_PROJECT_TYPES: ReadonlySet<string> = new Set<ProjectType>([
  "Exterior",
  "Exterior Painting",
  "Exterior Staining",
]);

export function isExteriorJob(projectType?: ProjectType | string): boolean {
  return projectType ? EXTERIOR_PROJECT_TYPES.has(projectType) : false;
}

/** Raw daily numbers, before concerns are derived. */
export type DailyWeatherInput = {
  date: string;
  weatherCode?: number;
  tempMaxF?: number;
  tempMinF?: number;
  precipProbabilityPct?: number;
  windSpeedMaxMph?: number;
  windGustMaxMph?: number;
};

/** Apply the thresholds to one day, producing concern kinds + readable labels. */
export function computeConcerns(d: DailyWeatherInput): {
  concerns: WeatherConcernKind[];
  labels: string[];
} {
  const concerns: WeatherConcernKind[] = [];
  const labels: string[] = [];
  const t = WEATHER_THRESHOLDS;

  if (
    d.precipProbabilityPct != null &&
    d.precipProbabilityPct >= t.precipProbabilityPct
  ) {
    concerns.push("rain");
    labels.push(`Rain ${Math.round(d.precipProbabilityPct)}%`);
  }
  if (d.tempMaxF != null && d.tempMaxF > t.tempMaxF) {
    concerns.push("heat");
    labels.push(`High ${Math.round(d.tempMaxF)}°F`);
  }
  if (d.tempMinF != null && d.tempMinF < t.tempMinF) {
    concerns.push("cold");
    labels.push(`Low ${Math.round(d.tempMinF)}°F`);
  }
  const gust = d.windGustMaxMph ?? 0;
  const sustained = d.windSpeedMaxMph ?? 0;
  if (gust >= t.windGustMph || sustained >= t.windSustainedMph) {
    concerns.push("wind");
    labels.push(`Wind ${Math.round(Math.max(gust, sustained))} mph`);
  }
  return { concerns, labels };
}

/** Inclusive list of YYYY-MM-DD dates a job spans (start..end, end defaults to start). */
export function datesInRange(start: string, end?: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end ?? start}T00:00:00Z`);
  // Guard against malformed ranges; cap iterations defensively.
  for (let i = 0; cur <= last && i < 366; i++) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

type SchedulableJob = {
  projectType?: ProjectType;
  scheduledStart?: string;
  scheduledEnd?: string;
};

/**
 * The forecast days that put an exterior job at risk: every day in the job's
 * span that has a weather concern. Empty for interior jobs, unscheduled jobs,
 * or jobs whose dates land on clear days (or outside the forecast window).
 */
export function jobWeatherConcernDays(
  job: SchedulableJob,
  forecastByDate: Map<string, DailyForecast>,
): DailyForecast[] {
  if (!isExteriorJob(job.projectType) || !job.scheduledStart) return [];
  return datesInRange(job.scheduledStart, job.scheduledEnd)
    .map((d) => forecastByDate.get(d))
    .filter((d): d is DailyForecast => Boolean(d?.hasConcern));
}
