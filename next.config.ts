import type { NextConfig } from "next";

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
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
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
