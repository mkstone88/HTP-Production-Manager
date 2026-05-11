import { Suspense } from "react";

import { ScheduleView } from "@/components/calendar/schedule-view";

export const metadata = { title: "Schedule · HTP" };

export default function SchedulePage() {
  // Suspense boundary so useSearchParams() inside ScheduleView can stream-render.
  return (
    <Suspense>
      <ScheduleView />
    </Suspense>
  );
}
