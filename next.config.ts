import type { NextConfig } from "next";

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
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' data: https://res.cloudinary.com https://fonts.gstatic.com",
            "img-src 'self' data: blob: https://res.cloudinary.com https://*.googleusercontent.com https://avatars.githubusercontent.com",
            "media-src 'self' https://res.cloudinary.com",
            "frame-src https://open.spotify.com",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "connect-src 'self' https://res.cloudinary.com https://fonts.googleapis.com https://fonts.gstatic.com https://*.upstash.io https://api.resend.com",
            "worker-src 'self' blob:",
            "report-uri /api/csp-violation",
          ].join("; "),
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