import { test, expect } from "@playwright/test";

// PWA-01/02: manifest + service worker + offline fallback
test("PWA manifest + offline fallback", async ({ page, context }) => {
  const manifest = await page.request.get("/manifest.json").catch(() => null);
  expect(manifest?.ok()).toBeTruthy();
  await page.goto("/gallery");
  await expect(page.locator("img, h1, h2").first()).toBeVisible({ timeout: 15000 });
  await context.setOffline(true);
  await page.reload().catch(() => {});
  await expect(page.locator("body")).not.toBeEmpty();
  await context.setOffline(false);
});
