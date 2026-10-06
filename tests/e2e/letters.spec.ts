import { test, expect } from "@playwright/test";
import { t } from "./timeout";

// LTR: public inbox heading + Tulis Surat page (or login redirect when anon)
test("public letters page shows Love Letters heading", async ({ page }) => {
  await page.goto("/letters");
  await expect(page.getByRole("heading", { name: /love letters/i }).first()).toBeVisible({ timeout: t(15000) });
});

test("new-letter page shows Tulis Surat heading when logged in", async ({ page }) => {
  // tiptap chunk + partner fetch under load can approach the 30s default.
  test.setTimeout(120_000);
  await page.goto("/dashboard/letters/new");
  if (page.url().includes("/login")) {
    await expect(page.getByRole("button", { name: /login dengan google/i })).toBeVisible({ timeout: t(15000) });
  } else {
    await expect(page.getByRole("heading", { name: /tulis surat/i })).toBeVisible({ timeout: t(15000) });
    // tiptap loads as a client-side chunk after the SSR heading — generous
    // budget under parallel-worker load (firefox needs the most).
    await expect(page.locator(".tiptap, [contenteditable=true]").first()).toBeVisible({ timeout: t(30000) });
  }
});
