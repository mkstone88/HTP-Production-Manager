import type { NextConfig } from "next";

/**
 * Baseline security headers. `frame-ancestors 'none'` (plus the legacy
 * X-Frame-Options) blocks clickjacking of the cookie-authed UI; the rest are
 * standard hardening. A full script-src CSP needs nonce plumbing through
 * Next's inline scripts — deferred, tracked in docs/reviews.
 */
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
