"use client";

import { useEffect } from "react";

/**
 * Registers the minimal service worker (public/sw.js): offline fallback page
 * + cache-first immutable assets. Production only — a SW in dev serves stale
 * build assets and fights fast refresh.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failing (private mode, unsupported) just means no
      // offline fallback — never break the app over it.
    });
  }, []);
  return null;
}
