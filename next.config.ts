import type { NextConfig } from "next";
import { CSP_DIRECTIVES } from "./lib/csp";
import { readFileSync } from "fs";
import { join } from "path";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const CSP_STRING = CSP_DIRECTIVES.join("; ");

// ── Build-time CSP drift check ─────────────────────────────────
// Reading vercel.json is best-effort (it may be absent in an unexpected cwd),
// but a mismatch MUST fail the build. The previous version threw inside the
// same try that caught it, so the guard could never fire.
let vercelCspValue: string | undefined;
try {
  const vercelRaw = readFileSync(join(process.cwd(), "vercel.json"), "utf-8");
  const vercelConfig = JSON.parse(vercelRaw);
  const vercelHeader = vercelConfig.headers?.find(
    (h: { source: string }) => h.source === "/(.*)",
  );
  vercelCspValue = vercelHeader?.headers?.find(
    (h: { key: string }) => h.key === "Content-Security-Policy",
  )?.value;
} catch {
  // no vercel.json here — nothing to compare against
}

if (vercelCspValue !== undefined && vercelCspValue !== CSP_STRING) {
  throw new Error(
    "CSP drift detected: vercel.json CSP does not match lib/csp.ts. " +
      "Run `npm run sync:csp` to sync them.",
  );
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [375, 480, 640, 768, 1024, 1280, 1536],
    minimumCacheTTL: 60 * 60 * 24,
  },

  headers: async () => [
    {
      // P-14: pages/static only — the global `public` Cache-Control competed with
      // per-route `private, no-cache` on /api/* JSON (sensitive payloads).
      source: "/((?!api/).*)",
      headers: [
        {
          key: "Content-Security-Policy",
          value: CSP_STRING,
        },
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
        {
          key: "X-Frame-Options",
          value: "DENY",
        },
        {
          key: "Referrer-Policy",
          value: "strict-origin-when-cross-origin",
        },
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
        {
          // least-privilege sensors — location comes from GPS API prompts, not ambient sensors.
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=()",
        },
        {
          key: "Cache-Control",
          value: "public, max-age=0, must-revalidate",
        },
        {
          key: "Link",
          value: [
            `<https://res.cloudinary.com>; rel=preconnect`,
          ].join(", "),
        },
      ],
    },
  ],

  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "@tiptap/react",
      "@tiptap/starter-kit",
    ],
    webpackBuildWorker: true,
    workerThreads: true,
  },
  serverExternalPackages: [
    "@prisma/client",
    "@neondatabase/serverless",
    "bcryptjs",
    "cloudinary",
  ],

  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
};

export default withBundleAnalyzer(nextConfig);