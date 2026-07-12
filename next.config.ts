import type { NextConfig } from "next";

let config: NextConfig = {
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

if (process.env.ANALYZE === "true") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const withBundleAnalyzer = require("@next/bundle-analyzer")({
    enabled: true,
  });
  config = withBundleAnalyzer(config);
}

export default config;
