import { test, expect } from "@playwright/test";

// PWA-01/02: manifest + service worker + offline fallback.
// The SW only intercepts once it controls the page — going offline before
// activation yields a bare network failure (empty body), so wait for the
// controller and warm the cache with one online reload first.
test("PWA manifest + offline fallback", async ({ page, context }) => {
  const manifest = await page.request.get("/manifest.json").catch(() => null);
  expect(manifest?.ok()).toBeTruthy();
  await page.goto("/gallery");
  await expect(page.locator("img, h1, h2").first()).toBeVisible({ timeout: 15000 });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20000 });
  await page.reload();
  await expect(page.locator("img, h1, h2").first()).toBeVisible({ timeout: 15000 });
  await context.setOffline(true);
  await page.reload().catch(() => {});
  await expect(page.locator("body")).not.toBeEmpty();
  await expect(page.locator("body")).toContainText(/kamu sedang offline|gallery/i, { timeout: 15000 });
  await context.setOffline(false);
});
