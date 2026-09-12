import { test, expect } from "@playwright/test";

// NOTE + WISH: public headings + dashboard management pages
test("public notes + wishlist headings", async ({ page }) => {
  await page.goto("/notes");
  await expect(page.getByRole("heading", { name: /daily note/i })).toBeVisible({ timeout: 15000 });
  await page.goto("/wishlist");
  await expect(page.getByRole("heading", { name: /wish list/i })).toBeVisible({ timeout: 15000 });
});

test("dashboard notes shows Kelola Daily Note when logged in", async ({ page }) => {
  await page.goto("/dashboard/notes");
  await page.waitForLoadState("networkidle");
  if (page.url().includes("/login")) {
    await expect(page.getByRole("button", { name: /login dengan google/i })).toBeVisible({ timeout: 15000 });
  } else {
    await expect(page.getByRole("heading", { name: /kelola daily note/i })).toBeVisible({ timeout: 15000 });
  }
});

test("dashboard wishlist shows Kelola Wish List when logged in", async ({ page }) => {
  await page.goto("/dashboard/wishlist");
  await page.waitForLoadState("networkidle");
  if (page.url().includes("/login")) {
    await expect(page.getByRole("button", { name: /login dengan google/i })).toBeVisible({ timeout: 15000 });
  } else {
    await expect(page.getByRole("heading", { name: /kelola wish list/i })).toBeVisible({ timeout: 15000 });
  }
});
