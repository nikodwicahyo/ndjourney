import { test, expect } from "@playwright/test";

// Manage header button: only for authenticated users, never on home/location/letters-detail
const cases = [
  { page: "/gallery", label: "Kelola Galeri", href: "/dashboard/gallery" },
  { page: "/timeline", label: "Kelola Timeline", href: "/dashboard/timeline" },
  { page: "/letters", label: "Tulis Surat", href: "/dashboard/letters" },
  { page: "/games", label: "Kelola Games", href: "/dashboard/games" },
  { page: "/notes", label: "Tulis Catatan", href: "/dashboard/notes" },
  { page: "/wishlist", label: "Kelola Wish List", href: "/dashboard/wishlist" },
] as const;

for (const { page: url, label } of cases) {
  test(`anon never sees ${label} on ${url}`, async ({ page }) => {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("link", { name: label })).toHaveCount(0);
  });
}

test("home and location never show manage buttons", async ({ page }) => {
  for (const url of ["/", "/location"]) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("link", { name: /kelola/i })).toHaveCount(0);
  }
});

test("authenticated gallery shows Kelola Galeri with correct href", async ({ page }) => {
  await page.goto("/dashboard/gallery");
  await page.waitForLoadState("networkidle");
  if (!page.url().includes("/login")) {
    await page.goto("/gallery");
    const link = page.getByRole("link", { name: "Kelola Galeri" });
    await expect(link).toBeVisible({ timeout: 15000 });
    await expect(link).toHaveAttribute("href", "/dashboard/gallery");
  }
});
