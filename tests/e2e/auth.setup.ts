import { test as setup } from "@playwright/test";
import path from "path";
import fs from "fs";

// Global auth setup: registers + logs in partner A via Credentials,
// stores session for all dependent projects (pattern: Playwright storageState).
// Falls back to empty state when server/seed unavailable so --list still works.
const AUTH_FILE = path.join(__dirname, "..", "..", "playwright", ".auth", "partner-a.json");

setup("authenticate as partner A", async ({ page }) => {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  try {
    const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
    const email = process.env.TEST_USER_EMAIL || "";
    const password = process.env.TEST_USER_PASSWORD || "";
    if (!email || !password) {
      await page.context().storageState({ path: AUTH_FILE });
      return;
    }
    await page.goto(`${baseURL}/login`);
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("button", { name: /masuk|login|sign in/i }).click();
    await page.waitForURL(/dashboard/, { timeout: 15000 });
    await page.context().storageState({ path: AUTH_FILE });
  } catch {
    await page.context().storageState({ path: AUTH_FILE });
  }
});
