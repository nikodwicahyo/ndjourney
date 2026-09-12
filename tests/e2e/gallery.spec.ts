import { test, expect } from "@playwright/test";
import path from "path";

// GAL: public gallery heading + dashboard Kelola Gallery (or login redirect when anon)
test("public gallery shows Gallery heading", async ({ page }) => {
  await page.goto("/gallery");
  await expect(page.getByRole("heading", { name: /^gallery$/i })).toBeVisible({ timeout: 15000 });
});

test("dashboard gallery requires auth and shows Kelola Gallery when logged in", async ({ page }) => {
  await page.goto("/dashboard/gallery");
  await page.waitForLoadState("networkidle");
  if (page.url().includes("/login")) {
    await expect(page.getByRole("button", { name: /login dengan google/i })).toBeVisible({ timeout: 15000 });
  } else {
    await expect(page.getByRole("heading", { name: /kelola gallery/i })).toBeVisible({ timeout: 15000 });
    const fileChooser = page.locator('input[type="file"]').first();
    if (await fileChooser.count()) {
      await fileChooser.setInputFiles(path.join(__dirname, "..", "fixtures", "pixel.png"));
      await expect(page.getByText(/berhasil|success|diunggah|upload/i).first()).toBeVisible({ timeout: 20000 });
    }
  }
});

test("timeline shows Love Timeline heading", async ({ page }) => {
  await page.goto("/timeline");
  await expect(page.getByRole("heading", { name: /love timeline/i })).toBeVisible({ timeout: 15000 });
});
