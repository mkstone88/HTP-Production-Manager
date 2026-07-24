/**
 * Minimal service worker for field use:
 *  - navigations are network-first with a branded offline fallback page, so
 *    losing signal at a job site shows "you're offline", not a browser error;
 *  - hashed build assets and icons are cached cache-first (immutable);
 *  - /api is never cached — data always comes from the network.
 *
 * Bump CACHE_VERSION when the offline page or caching strategy changes.
 */
const CACHE_VERSION = "htp-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

const CACHE_FIRST_PREFIXES = ["/_next/static/", "/icons/", "/branding/"];

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Page navigations: network first, offline fallback.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(OFFLINE_URL).then((hit) => hit ?? Response.error()),
      ),
    );
    return;
  }

  // Immutable assets: cache first, fill the cache from the network.
  if (CACHE_FIRST_PREFIXES.some((p) => url.pathname.startsWith(p))) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
  // Everything else (incl. /api): straight to the network, untouched.
});
