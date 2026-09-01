import type { NextConfig } from "next";

/**
 * Baseline security headers. A full, tightened Content-Security-Policy
 * (compatible with Stripe + Supabase) is added in Phase 7 alongside HSTS in
 * production. Image `remotePatterns` for the Supabase Storage bucket are added
 * in Phase 2 when the bucket host is known.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/media/**",
      },
    ],
  },
  async rewrites() {
    // Default: Next.js serves `/api/v1` from the bundled catalog (Vercel-ready).
    // Set USE_FASTAPI=1 to proxy to the local Python collector during development.
    if (process.env.USE_FASTAPI === "1") {
      const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      return [
        { source: "/api/v1/:path*", destination: `${api}/api/v1/:path*` },
        { source: "/media/:path*", destination: `${api}/media/:path*` },
      ];
    }
    return [];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
