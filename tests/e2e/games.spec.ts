import { test, expect } from "@playwright/test";

// GAM: public games tabs + dashboard Kelola Games leaderboard
test("public games page lists game modes", async ({ page }) => {
  await page.goto("/games");
  await expect(page.getByText(/would you rather\?|love quiz|spin the wheel/i).first()).toBeVisible({ timeout: 15000 });
});

test("dashboard games shows Kelola Games + Leaderboard when logged in", async ({ page }) => {
  await page.goto("/dashboard/games");
  await page.waitForLoadState("networkidle");
  if (page.url().includes("/login")) {
    await expect(page.getByRole("button", { name: /login dengan google/i })).toBeVisible({ timeout: 15000 });
  } else {
    await expect(page.getByRole("heading", { name: /kelola games/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("heading", { name: /leaderboard/i })).toBeVisible({ timeout: 10000 });
  }
});
