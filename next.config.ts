import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const usesLocalSupabase =
  supabaseUrl.startsWith("http://127.0.0.1:54321") ||
  supabaseUrl.startsWith("http://localhost:54321");
const scriptSource = [
  "script-src",
  "'self'",
  "'unsafe-inline'",
  // React and Next.js dev overlays use eval-based debugging helpers locally.
  ...(isDevelopment ? ["'unsafe-eval'"] : []),
].join(" ");
const connectSource = [
  "connect-src",
  "'self'",
  "https://*.supabase.co",
  "wss://*.supabase.co",
  "https://fonts.googleapis.com",
  ...(isDevelopment || usesLocalSupabase
    ? [
        "http://127.0.0.1:54321",
        "http://localhost:54321",
        "ws://127.0.0.1:54321",
        "ws://localhost:54321",
      ]
    : []),
].join(" ");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              scriptSource,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              connectSource,
              "object-src 'none'",
              "frame-src 'none'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "manifest-src 'self'",
              "media-src 'self'",
              "worker-src 'self' blob:",
            ].join("; "),
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "Origin-Agent-Cluster", value: "?1" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
