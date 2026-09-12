import { test, expect } from "@playwright/test";

// AUTH-07: guard redirects + real login form (labels from components/auth/LoginForm.tsx)
test("unauthenticated /dashboard redirects to /login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?.*reason=unauthorized/);
  await expect(page.getByRole("button", { name: /login dengan google/i })).toBeVisible({ timeout: 15000 });
});

test("public /gallery renders read-only without login", async ({ page }) => {
  await page.goto("/gallery");
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: /^gallery$/i })).toBeVisible({ timeout: 15000 });
});

test("login form has email+password fields and validates", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByPlaceholder("nama@email.com")).toBeVisible({ timeout: 15000 });
  await expect(page.getByPlaceholder("••••••••")).toBeVisible();
  await page.getByRole("button", { name: /^masuk|login$/i }).first().click();
  await expect(page.getByText(/wajib|valid|isi/i).first()).toBeVisible({ timeout: 5000 });
});

test("invite page with bad token shows error state", async ({ page }) => {
  await page.goto("/invite/definitely-wrong-token");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toContainText(/undangan|invite|tidak valid|kedaluwarsa|error/i, { timeout: 15000 });
});
