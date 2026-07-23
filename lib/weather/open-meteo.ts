import "server-only";

import { weatherLocation } from "./config";
import { computeConcerns } from "./risk";
import type { DailyForecast, WeatherForecast } from "./types";

/**
 * Open-Meteo: free, keyless, US units, up to 16 days of daily forecast.
 * https://open-meteo.com/en/docs
 */
const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const MAX_FORECAST_DAYS = 16;

const DAILY_FIELDS = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "precipitation_probability_max",
  "wind_speed_10m_max",
  "wind_gusts_10m_max",
].join(",");

type OpenMeteoResponse = {
  daily?: {
    time: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
    wind_speed_10m_max?: number[];
    wind_gusts_10m_max?: number[];
  };
};

/**
 * Fetch the metro forecast and fold in derived weather concerns. Cached at the
 * fetch layer for an hour — the forecast barely moves minute to minute and we
 * don't want to hammer the provider on every toggle.
 */
export async function fetchForecast(days = MAX_FORECAST_DAYS): Promise<WeatherForecast> {
  const loc = weatherLocation();
  const url = new URL(OPEN_METEO_URL);
  url.searchParams.set("latitude", String(loc.latitude));
  url.searchParams.set("longitude", String(loc.longitude));
  url.searchParams.set("daily", DAILY_FIELDS);
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("precipitation_unit", "inch");
  url.searchParams.set("timezone", loc.timezone);
  url.searchParams.set(
    "forecast_days",
    String(Math.min(Math.max(Math.trunc(days), 1), MAX_FORECAST_DAYS)),
  );

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error(`Weather provider error (${res.status})`);
  }
  const data = (await res.json()) as OpenMeteoResponse;
  const daily = data.daily;

  const out: DailyForecast[] = (daily?.time ?? []).map((date, i) => {
    const input = {
      date,
      weatherCode: daily?.weather_code?.[i],
      tempMaxF: daily?.temperature_2m_max?.[i],
      tempMinF: daily?.temperature_2m_min?.[i],
      precipProbabilityPct: daily?.precipitation_probability_max?.[i],
      windSpeedMaxMph: daily?.wind_speed_10m_max?.[i],
      windGustMaxMph: daily?.wind_gusts_10m_max?.[i],
    };
    const { concerns, labels } = computeConcerns(input);
    return {
      ...input,
      concerns,
      concernLabels: labels,
      hasConcern: concerns.length > 0,
    };
  });

  return { location: loc, days: out };
}
