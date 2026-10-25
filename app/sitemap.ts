import type { MetadataRoute } from "next";

// Dynamic detail pages (letters/[id]) are intentionally omitted: there is no
// route-level index to enumerate them from, and every public page here is
// linked from the navbar anyway.
const PUBLIC_ROUTES = [
  "",
  "/timeline",
  "/gallery",
  "/notes",
  "/letters",
  "/wishlist",
  "/games",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXTAUTH_URL ?? "https://ndjourney.vercel.app").replace(/\/$/, "");
  const lastModified = new Date();

  return PUBLIC_ROUTES.map((route) => ({
    url: `${base}${route}`,
    lastModified,
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.7,
  }));
}
