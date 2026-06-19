import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/airtable/errors";
import { JobsRepo } from "@/lib/airtable/jobs";
import { fetchForecast } from "@/lib/weather/open-meteo";
import { jobWeatherConcernDays } from "@/lib/weather/risk";

export const revalidate = 3600;

/**
 * GET /api/weather/risk — scheduled exterior jobs that fall on days with a
 * weather concern, newest start first. The production manager's "what should I
 * worry about this week?" view: not a directive to cancel, just a flag to
 * review (reschedule, shift crews, plan around the wind, etc.).
 *
 * Future agent tool: "which jobs are threatened by weather this week?"
 */
export async function GET() {
  try {
    const [jobs, forecast] = await Promise.all([
      JobsRepo.list(),
      fetchForecast(),
    ]);
    const byDate = new Map(forecast.days.map((d) => [d.date, d]));

    const atRisk = jobs
      .filter((j) => j.status !== "Completed")
      .flatMap((job) => {
        const concernDays = jobWeatherConcernDays(job, byDate);
        return concernDays.length ? [{ job, concernDays }] : [];
      })
      .sort((a, b) =>
        (a.job.scheduledStart ?? "").localeCompare(b.job.scheduledStart ?? ""),
      );

    return NextResponse.json({ location: forecast.location, atRisk });
  } catch (err) {
    return errorResponse(err);
  }
}
