import { test, expect } from "@playwright/test";

// DASH: anonymous → login; logged in → Statistik section
test("dashboard guard + stats", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  if (page.url().includes("/login")) {
    await expect(page.getByRole("button", { name: /login dengan google/i })).toBeVisible({ timeout: 15000 });
  } else {
    await expect(page.getByRole("heading", { name: /statistik/i })).toBeVisible({ timeout: 15000 });
  }
});

test("home page renders brand title", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/ndjourney|couple|cerita/i, { timeout: 15000 });
  await expect(page.locator("body")).not.toBeEmpty();
});
