import type { NextConfig } from "next";

const dev = process.env.NODE_ENV === "development";
// Vercel's comment toolbar on preview deployments loads from vercel.live.
const vercelLive = process.env.VERCEL_ENV === "preview" ? " https://vercel.live" : "";

// Everything loads from this site, except auth/data calls to Supabase. Blocks
// injected scripts from loading code or sending data anywhere else.
// ponytail: 'unsafe-inline' scripts (theme script + Next's inline payloads); per-request
// nonces via proxy.ts would remove it but make every page dynamically rendered.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}${vercelLive}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL}${vercelLive}`,
  `frame-src 'self'${vercelLive}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  // Don't advertise the framework in an X-Powered-By header.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // No page may be embedded in another site (clickjacking, e.g. the
          // delete-account form).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: csp },
          // Keeps auth codes in URLs out of Referer headers sent to other sites.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Browsers must not guess a different content type than the server sent.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // The app uses none of these browser features, so no page (or
          // injected script) may ask for them.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
