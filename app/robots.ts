import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXTAUTH_URL ?? "https://ndjourney.vercel.app").replace(/\/$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private app surfaces + auth flows; the public story pages stay open.
        disallow: ["/api/", "/dashboard/", "/login", "/invite/", "/auth-error"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
