import { test, expect } from "@playwright/test";
import { t } from "./timeout";

// DASH: anonymous → login; logged in → Statistik section
test("dashboard guard + stats", async ({ page }) => {
  await page.goto("/dashboard");
  if (page.url().includes("/login")) {
    await expect(page.getByRole("button", { name: /login dengan google/i })).toBeVisible({ timeout: t(15000) });
  } else {
    await expect(page.getByRole("heading", { name: /statistik/i })).toBeVisible({ timeout: t(15000) });
  }
});

test("home page renders brand title", async ({ page }) => {
  // domcontentloaded: window `load` can hang on slow subresources (fonts,
  // images) long after the document is interactive and asserted below.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle(/ndjourney|couple|cerita/i, { timeout: t(15000) });
  await expect(page.locator("body")).not.toBeEmpty();
});
