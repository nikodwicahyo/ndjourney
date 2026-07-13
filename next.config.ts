import type { NextConfig } from "next";
import { CSP_DIRECTIVES } from "./lib/csp";
import { readFileSync } from "fs";
import { join } from "path";

const CSP_STRING = CSP_DIRECTIVES.join("; ");

// ── Build-time CSP drift check ─────────────────────────────────
try {
  const vercelJsonPath = join(process.cwd(), "vercel.json");
  const vercelRaw = readFileSync(vercelJsonPath, "utf-8");
  const vercelConfig = JSON.parse(vercelRaw);
  const vercelHeader = vercelConfig.headers?.find(
    (h: { source: string }) => h.source === "/(.*)",
  );
  const vercelCspEntry = vercelHeader?.headers?.find(
    (h: { key: string }) => h.key === "Content-Security-Policy",
  );
  if (vercelCspEntry?.value !== CSP_STRING) {
    console.warn(
      "\x1b[33m⚠ CSP drift detected: vercel.json CSP does not match lib/csp.ts\x1b[0m\n" +
        "\x1b[33m  Run `node scripts/sync-csp.mjs` to sync them.\x1b[0m",
    );
  }
} catch {
  // skip check when cwd is unexpected
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
      source: "/(.*)",
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
          key: "Cache-Control",
          value: "public, max-age=0, must-revalidate",
        },
        {
          key: "Link",
          value: [
            `<https://fonts.googleapis.com>; rel=preconnect`,
            `<https://fonts.gstatic.com>; rel=preconnect; crossorigin`,
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
  output: "standalone",
};

export default nextConfig;