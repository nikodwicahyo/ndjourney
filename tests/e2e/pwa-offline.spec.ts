import { test, expect } from "@playwright/test";
import { t } from "./timeout";

// PWA-01/02: manifest + service worker + offline fallback.
// Settle assertions use gallery-specific content, never generic selectors:
// an app error page also contains h1/img and would pass those vacuously,
// hiding the real failure (proven on CI).
test("PWA manifest + offline fallback", async ({ page, context }) => {
  const manifest = await page.request.get("/manifest.json").catch(() => null);
  expect(manifest?.ok()).toBeTruthy();
  const galleryHeading = page.getByRole("heading", { name: /^gallery$/i });
  await page.goto("/gallery");
  await expect(galleryHeading).toBeVisible({ timeout: t(15000) });
  // Fail fast on the app error boundary instead of asserting past it.
  await expect(page.getByText(/ada yang salah/i)).toHaveCount(0);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: t(20000) });
  await page.reload();
  await expect(galleryHeading).toBeVisible({ timeout: t(15000) });
  await expect(page.getByText(/ada yang salah/i)).toHaveCount(0);
  await context.setOffline(true);
  await page.reload().catch(() => {});
  await expect(page.locator("body")).not.toBeEmpty();
  // Online-cached gallery OR the offline fallback page both prove correct
  // offline behavior; the app error boundary must never appear.
  await expect(page.getByText(/ada yang salah/i)).toHaveCount(0);
  await expect(page.locator("body")).toContainText(/kamu sedang offline|gallery/i, { timeout: t(15000) });
  await context.setOffline(false);
});
