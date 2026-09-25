import type { NextConfig } from "next";

/**
 * Security headers, applied to every response.
 *
 * Deliberately *not* a full Content-Security-Policy: Next injects inline
 * bootstrap scripts, so a real CSP needs per-request nonces and a middleware
 * change, and a half-written one either breaks the app or lulls you into
 * thinking you have a policy you don't. `X-Frame-Options` covers the
 * clickjacking case that actually matters for an admin app behind a session
 * cookie; CSP is a separate, deliberate piece of work.
 */
const securityHeaders = [
  // The admin app must never be framed — it's a session-cookie-authenticated
  // surface with destructive controls (approve, cancel, record payment).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak admin URLs (which embed appointment/client UUIDs) to third
  // parties in the Referer header.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing here uses these APIs.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // Railway terminates TLS and serves this over HTTPS only.
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
