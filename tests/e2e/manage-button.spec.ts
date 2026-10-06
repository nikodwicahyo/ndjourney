import { test, expect } from "@playwright/test";
import { t } from "./timeout";

// Manage header button: only for authenticated users, never on home/location/letters-detail.
// NOTE: all projects share the partner-A storageState, so anonymous cases
// must explicitly opt out of it — otherwise they run logged in and the
// absence assertions below would (correctly) fail.
test.describe("anonymous (no storageState)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  // heading: positive settle signal per page, so the toHaveCount(0) below
  // can never pass vacuously on a half-loaded page.
  const cases = [
    { page: "/gallery", label: "Kelola Galeri", heading: /^gallery$/i },
    { page: "/timeline", label: "Kelola Timeline", heading: /love timeline/i },
    { page: "/letters", label: "Tulis Surat", heading: /love letters/i },
    { page: "/games", label: "Kelola Games", heading: /masuk untuk main/i },
    { page: "/notes", label: "Tulis Catatan", heading: /daily note/i },
    { page: "/wishlist", label: "Kelola Wish List", heading: /wish list/i },
  ] as const;

  for (const { page: url, label, heading } of cases) {
    test(`anon never sees ${label} on ${url}`, async ({ page }) => {
      await page.goto(url);
      await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible({ timeout: t(15000) });
      await expect(page.getByRole("link", { name: label })).toHaveCount(0);
    });
  }

  test("home never shows manage buttons", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/ndjourney/i, { timeout: t(15000) });
    await expect(page.getByRole("link", { name: /kelola/i })).toHaveCount(0);
  });

  test("location requires login for anon", async ({ page }) => {
    await page.goto("/location");
    await expect(page).toHaveURL(/\/login/, { timeout: t(15000) });
    await expect(page.getByRole("link", { name: /kelola/i })).toHaveCount(0);
  });
});

test("authenticated gallery shows Kelola Galeri with correct href", async ({ page }) => {
  await page.goto("/gallery");
  if (page.url().includes("/login")) {
    // Local runs without TEST_USER_* creds save an empty state — nothing to assert.
    test.skip(true, "no authenticated storageState (missing TEST_USER_* creds?)");
    return;
  }
  const link = page.getByRole("link", { name: "Kelola Galeri" });
  await expect(link).toBeVisible({ timeout: t(15000) });
  await expect(link).toHaveAttribute("href", "/dashboard/gallery");
});
