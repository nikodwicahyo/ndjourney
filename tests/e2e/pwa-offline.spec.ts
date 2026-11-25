import { test, expect } from "@playwright/test";
import { t } from "./timeout";

// PWA-01/02: manifest + service worker + offline fallback.
// Non-home public pages must fall back to /offline.html when offline; home must
// keep its cached shell. Assert on the offline copy, never generic selectors:
// an app error page also contains h1/img and would pass those vacuously.
// Copy is editable product text; match either the current or previous wording.
const OFFLINE_COPY = /terputus|kamu sedang offline/i;
const ERROR_COPY = /ada yang salah/i;
const PUBLIC_PAGES = ["/gallery", "/timeline", "/games", "/notes", "/letters", "/wishlist"];

// One dev server compiling several pages at once starves the idle callback
// that registers the worker; run these browser tests one at a time.
test.describe.configure({ mode: "serial" });

async function waitForServiceWorker(page: import("@playwright/test").Page) {
  await page.goto("/");
  // Registration is deferred until the page is idle; in dev with several
  // workers compiling at once, the initial page may never gain a controller.
  // Wait for an active registration, then reload so the worker takes control.
  await page.waitForFunction(
    async () => !!(await navigator.serviceWorker.getRegistration())?.active,
    null,
    { timeout: t(30000) },
  );
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: t(30000) });
}

test("non-home public pages show the offline screen when offline", async ({ page, context }) => {
  test.setTimeout(180_000);
  const manifest = await page.request.get("/manifest.json").catch(() => null);
  expect(manifest?.ok()).toBeTruthy();
  await waitForServiceWorker(page);

  for (const path of PUBLIC_PAGES) {
    await context.setOffline(false);
    await page.goto(path);
    await expect(page.getByText(ERROR_COPY)).toHaveCount(0);
    await context.setOffline(true);
    await page.reload().catch(() => {});
    await expect(page.locator("body")).not.toBeEmpty();
    await expect(page.getByText(ERROR_COPY)).toHaveCount(0);
    await expect(page.getByText(OFFLINE_COPY)).toBeVisible({ timeout: t(15000) });
    await context.setOffline(false);
  }
});

test("home still serves its cached shell when offline", async ({ page, context }) => {
  test.setTimeout(120_000);
  await waitForServiceWorker(page);
  await page.reload();
  await expect(page.getByText(ERROR_COPY)).toHaveCount(0);

  await context.setOffline(true);
  await page.reload().catch(() => {});
  await expect(page.locator("body")).not.toBeEmpty();
  await expect(page.getByText(OFFLINE_COPY)).toHaveCount(0);
  await expect(page.getByText(ERROR_COPY)).toHaveCount(0);
  await expect(page.locator("header").first()).toBeVisible();
  await context.setOffline(false);
});

test("private routes keep the offline screen fallback", async ({ page, context }) => {
  test.setTimeout(120_000);
  await waitForServiceWorker(page);
  await page.goto("/dashboard");
  await expect(page.getByText(OFFLINE_COPY)).toHaveCount(0);

  await context.setOffline(true);
  await page.reload().catch(() => {});
  await expect(page.getByText(OFFLINE_COPY)).toBeVisible({ timeout: t(15000) });
  await expect(page.getByText(ERROR_COPY)).toHaveCount(0);
  await context.setOffline(false);
});
