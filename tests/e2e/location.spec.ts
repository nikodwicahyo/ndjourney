import { test, expect } from "@playwright/test";

// LOC: location page loads with granted geolocation; dashboard settings page guarded
test("location page loads map shell", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: -6.2, longitude: 106.816666 });
  await page.goto("/location");
  await expect(page).toHaveTitle(/lokasi/i, { timeout: 15000 });
  await expect(page.locator("body")).toContainText(/lokasi|pasangan|peta|map|bagikan/i, { timeout: 15000 });
});

test("dashboard settings shows Pengaturan when logged in", async ({ page }) => {
  await page.goto("/dashboard/settings");
  await page.waitForLoadState("networkidle");
  if (page.url().includes("/login")) {
    await expect(page.getByRole("button", { name: /login dengan google/i })).toBeVisible({ timeout: 15000 });
  } else {
    await expect(page.getByRole("heading", { name: /pengaturan/i })).toBeVisible({ timeout: 15000 });
  }
});
