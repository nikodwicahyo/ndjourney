import { test as setup, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

// Global auth setup: logs in partner A via Credentials, stores session for
// all dependent projects (pattern: Playwright storageState).
//
// Hardened after the first real E2E run proved three setup bugs:
//  1. waitForURL(/dashboard/) false-positives on the bounce URL
//     /login?callbackUrl=%2Fdashboard (substring match) — setup "passed"
//     while anonymous, cascading into dozens of misleading failures.
//  2. Clicking submit before React hydration attaches onSubmit fires a
//     native submit (password lands in the URL query, no session) —
//     settle for hydration first.
//  3. Silent empty-state fallback masked login failures — the session
//     cookie is now asserted, loudly, on every run with creds.
const AUTH_FILE = path.join(__dirname, "..", "..", "playwright", ".auth", "partner-a.json");

setup("authenticate as partner A", async ({ page }) => {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
  const email = process.env.TEST_USER_EMAIL || "";
  const password = process.env.TEST_USER_PASSWORD || "";
  if (!email || !password) {
    // C-01: an empty storageState makes every "authed" spec pass vacuously
    // via its anon fork. Fail loudly on CI (where creds are mandatory);
    // locally keep the empty state so --list and anon runs still work.
    if (process.env.CI) {
      throw new Error("auth.setup: TEST_USER_EMAIL/TEST_USER_PASSWORD are required on CI");
    }
    await page.context().storageState({ path: AUTH_FILE });
    return;
  }

  await page.goto(`${baseURL}/login`);
  // Let hydration attach the submit handler before clicking — a pre-hydration
  // click fires a native GET submit (credentials in URL, no session).
  await expect(page.getByPlaceholder("nama@email.com")).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder("nama@email.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: /^masuk|login$/i }).first().click();
  // Strict path match — /login?callbackUrl=%2Fdashboard must NOT satisfy this.
  await expect(page).toHaveURL(/\/dashboard\/?(\?|#|$)/, { timeout: 20000 });
  expect(new URL(page.url()).pathname).not.toContain("/login");
  // The session cookie is the whole point of this file — never save without it.
  const names = (await page.context().cookies()).map((c) => c.name);
  expect(names).toContain("authjs.session-token");
  await page.context().storageState({ path: AUTH_FILE });
});
