import { test, expect } from "@playwright/test";
import { t } from "./timeout";

// LOC: location page loads with granted geolocation; dashboard settings page guarded
test("location page loads map shell", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: -6.2, longitude: 106.816666 });
  await page.goto("/location");
  await expect(page).toHaveTitle(/lokasi/i, { timeout: t(15000) });
  await expect(page.locator("body")).toContainText(/lokasi|pasangan|peta|map|bagikan/i, { timeout: t(15000) });
});

test("dashboard settings shows Pengaturan when logged in", async ({ page }) => {
  // domcontentloaded: settings pulls profile+couple data client-side; the
  // heading assertion below is the real readiness signal, not window load.
  await page.goto("/dashboard/settings", { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await expect(page.getByRole("button", { name: /login dengan google/i })).toBeVisible({ timeout: t(15000) });
  } else {
    await expect(page.getByRole("heading", { name: /pengaturan/i })).toBeVisible({ timeout: t(15000) });
  }
});
