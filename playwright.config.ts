import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/partner-a.json",
      },
    },
    {
      name: "mobile",
      dependencies: ["setup"],
      use: {
        ...devices["Pixel 7"],
        storageState: "playwright/.auth/partner-a.json",
      },
    },
    {
      name: "firefox",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Firefox"],
        storageState: "playwright/.auth/partner-a.json",
      },
    },
  ],
  // CI builds first (test.yml), then serves the production build so specs run
  // against something. reuseExistingServer lets the workflow start the server
  // once for both the smoke check and the specs. Locally keep `next dev`.
  webServer: {
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
