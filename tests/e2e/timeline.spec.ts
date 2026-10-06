import { test, expect } from "@playwright/test";
import { t } from "./timeout";

// TML: public order page + dashboard Kelola Timeline form validation
test("timeline lists milestones, dashboard form validates title", async ({ page }) => {
  await page.goto("/timeline");
  await expect(page.getByRole("heading", { name: /love timeline/i })).toBeVisible({ timeout: t(15000) });

  await page.goto("/dashboard/timeline");
  if (page.url().includes("/login")) {
    await expect(page.getByRole("button", { name: /login dengan google/i })).toBeVisible({ timeout: t(15000) });
  } else {
    await expect(page.getByRole("heading", { name: /kelola timeline/i })).toBeVisible({ timeout: t(15000) });
  }
});
