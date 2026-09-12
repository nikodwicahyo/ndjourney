import { test, expect } from "@playwright/test";

// LTR: public inbox heading + Tulis Surat page (or login redirect when anon)
test("public letters page shows Love Letters heading", async ({ page }) => {
  await page.goto("/letters");
  await expect(page.getByRole("heading", { name: /love letters/i }).first()).toBeVisible({ timeout: 15000 });
});

test("new-letter page shows Tulis Surat heading when logged in", async ({ page }) => {
  await page.goto("/dashboard/letters/new");
  await page.waitForLoadState("networkidle");
  if (page.url().includes("/login")) {
    await expect(page.getByRole("button", { name: /login dengan google/i })).toBeVisible({ timeout: 15000 });
  } else {
    await expect(page.getByRole("heading", { name: /tulis surat/i })).toBeVisible({ timeout: 15000 });
    await expect(page.locator(".tiptap, [contenteditable=true]").first()).toBeVisible({ timeout: 10000 });
  }
});
