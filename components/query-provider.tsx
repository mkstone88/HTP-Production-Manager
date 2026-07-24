"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // Focus refetch stays ON: visibilitychange fires when the
            // installed PWA resumes from the background, which is how stale
            // morning data refreshes when the app reopens in the afternoon.
            // staleTime above keeps quick tab-flips from thrashing.
            retry: 1,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
