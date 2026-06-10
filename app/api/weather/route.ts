import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/airtable/errors";
import { JobsRepo } from "@/lib/airtable/jobs";

export const dynamic = "force-dynamic";

/**
 * Daily forecast for the OKC metro (Open-Meteo — free, no API key) plus the
 * exterior jobs scheduled on rainy days. The upstream fetch is cached for 30
 * minutes via the Next.js fetch cache, so refreshes don't hammer the API.
 *
 * Future agent tool: "is rain going to hit any exterior jobs this week?"
 */

const OKC = { latitude: 35.4676, longitude: -97.5164 };
const FORECAST_DAYS = 14;
const RAIN_RISK_THRESHOLD = 50; // % precipitation probability

export type ForecastDay = {
  date: string; // YYYY-MM-DD
  precipProbability: number; // 0-100
  weatherCode: number; // WMO code
  tempMaxF: number;
  tempMinF: number;
};

export type RainRiskJob = {
  id: string;
  name: string;
  projectType?: string;
  scheduledStart: string;
  scheduledEnd: string;
  /** Rainy forecast days that fall within the job's scheduled range. */
  days: { date: string; precipProbability: number }[];
};

type OpenMeteoResponse = {
  daily?: {
    time: string[];
    precipitation_probability_max: (number | null)[];
    weather_code: (number | null)[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
  };
};

async function fetchForecast(): Promise<ForecastDay[]> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(OKC.latitude));
  url.searchParams.set("longitude", String(OKC.longitude));
  url.searchParams.set(
    "daily",
    "precipitation_probability_max,weather_code,temperature_2m_max,temperature_2m_min",
  );
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("timezone", "America/Chicago");
  url.searchParams.set("forecast_days", String(FORECAST_DAYS));

  const res = await fetch(url, { next: { revalidate: 1800 } });
  if (!res.ok) throw new Error(`Weather service returned ${res.status}`);
  const body = (await res.json()) as OpenMeteoResponse;
  const d = body.daily;
  if (!d) return [];
  return d.time.map((date, i) => ({
    date,
    precipProbability: d.precipitation_probability_max[i] ?? 0,
    weatherCode: d.weather_code[i] ?? 0,
    tempMaxF: Math.round(d.temperature_2m_max[i] ?? 0),
    tempMinF: Math.round(d.temperature_2m_min[i] ?? 0),
  }));
}

function isExterior(projectType: string | undefined): boolean {
  return Boolean(projectType && projectType.startsWith("Exterior"));
}

export async function GET() {
  try {
    const [days, jobs] = await Promise.all([fetchForecast(), JobsRepo.list()]);

    const rainyByDate = new Map(
      days
        .filter((d) => d.precipProbability >= RAIN_RISK_THRESHOLD)
        .map((d) => [d.date, d.precipProbability]),
    );

    const rainRisk: RainRiskJob[] = [];
    for (const j of jobs) {
      if (!j.scheduledStart) continue;
      if (j.status === "Completed" || j.status === "On Hold") continue;
      if (!isExterior(j.projectType)) continue;
      const start = j.scheduledStart;
      const end = j.scheduledEnd ?? j.scheduledStart;
      const hits = [...rainyByDate]
        .filter(([date]) => date >= start && date <= end)
        .map(([date, precipProbability]) => ({ date, precipProbability }));
      if (hits.length > 0) {
        rainRisk.push({
          id: j.id,
          name: j.name || j.customerName || "Job",
          projectType: j.projectType,
          scheduledStart: start,
          scheduledEnd: end,
          days: hits,
        });
      }
    }
    rainRisk.sort((a, b) => a.days[0].date.localeCompare(b.days[0].date));

    return NextResponse.json({ days, rainRisk });
  } catch (err) {
    return errorResponse(err);
  }
}
