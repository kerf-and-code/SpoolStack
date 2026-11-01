import type { NextConfig } from "next";

// Security headers follow the Next 16 PWA guide
// (node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md).
const nextConfig: NextConfig = {
  experimental: {
    // A Server Action called with no network stays pending and runs again
    // when the connection returns, instead of throwing into the /app error
    // boundary and taking the form (and everything typed in it) with it.
    // (node_modules/next/dist/docs/01-app/02-guides/offline-support.md,
    // "Retry Server Actions after the network returns".) Forms pair this with
    // useOffline from next/offline to say so on the button.
    useOffline: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // The service worker must never be cached, or a fix to it can take
        // days to reach installed copies.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
