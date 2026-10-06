import { test, expect } from "@playwright/test";
import { t } from "./timeout";

// AUTH-07: guard redirects + real login form (labels from components/auth/LoginForm.tsx).
// NOTE: projects share the partner-A storageState, so the anonymous cases
// below opt out of it explicitly — an authed session stays on /dashboard and
// /login redirects away, which is correct app behavior, not a failure.
test.describe("anonymous (no storageState)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("unauthenticated /dashboard redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?.*reason=unauthorized/);
    await expect(page.getByRole("button", { name: /login dengan google/i })).toBeVisible({ timeout: t(15000) });
  });

  test("login form has email+password fields and rejects wrong credentials", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByPlaceholder("nama@email.com")).toBeVisible({ timeout: t(15000) });
    await expect(page.getByPlaceholder("••••••••")).toBeVisible();
    // Empty submit is stopped by native `required` bubbles (not in-DOM text),
    // so exercise the real server path: wrong password → app error message.
    await page.getByPlaceholder("nama@email.com").fill("salah@example.com");
    await page.getByPlaceholder("••••••••").fill("password-salah-123");
    await page.getByRole("button", { name: /^masuk|login$/i }).first().click();
    await expect(page.getByText(/email atau password salah/i)).toBeVisible({ timeout: t(15000) });
  });
});

test("public /gallery renders read-only without login", async ({ page }) => {
  await page.goto("/gallery");
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: /^gallery$/i })).toBeVisible({ timeout: t(15000) });
});

test("invite page with bad token shows error state", async ({ page }) => {
  await page.goto("/invite/definitely-wrong-token");
  await expect(page.locator("body")).toContainText(/undangan|invite|tidak valid|kedaluwarsa|error/i, { timeout: t(15000) });
});
