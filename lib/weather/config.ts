import "server-only";

import type { WeatherLocation } from "./types";

/**
 * The forecast is metro-wide: every HTP job is in the Oklahoma City metro, so a
 * single point forecast is a good visual proxy without geocoding each address.
 * Override per-deployment via env if the service area ever moves.
 *
 *   WEATHER_LAT, WEATHER_LON   — decimal degrees
 *   WEATHER_TIMEZONE           — IANA tz (e.g. America/Chicago)
 *   WEATHER_LOCATION_NAME      — label shown in the UI
 */
export function weatherLocation(): WeatherLocation {
  const num = (name: string, fallback: number) => {
    const v = process.env[name];
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    name: process.env.WEATHER_LOCATION_NAME || "Oklahoma City, OK",
    latitude: num("WEATHER_LAT", 35.4676),
    longitude: num("WEATHER_LON", -97.5164),
    timezone: process.env.WEATHER_TIMEZONE || "America/Chicago",
  };
}
