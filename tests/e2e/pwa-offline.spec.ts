import { test, expect, type Page } from "@playwright/test";
import { t } from "./timeout";

// Playwright's Firefox offline mode does not fail service-worker fetches, so a
// Firefox run exercises its HTTP cache instead of the SW fallback. The worker
// is browser-agnostic JS; Chromium + mobile cover the real navigation path.
test.skip(
  ({ browserName }) => browserName === "firefox",
  "Firefox offline emulation does not reach service-worker fetch handlers",
);

// PWA-01/02: manifest + service worker + offline fallback.
// Non-home public pages and private routes must fall back to /offline.html when
// offline; home must keep its cached shell. Assert on the offline page's own
// heading: a stale public shell or app error page also has h1/img selectors.
const OFFLINE_COPY = /terputus|kamu sedang offline/i;
const ERROR_COPY = /ada yang salah/i;
const PUBLIC_PAGES = ["/gallery", "/timeline", "/games", "/notes", "/letters", "/wishlist"];
const PRIVATE_PAGES = ["/dashboard", "/dashboard/gallery", "/location"];
const ASSERTION_BUDGET = t(15000);
const SW_WAIT_BUDGET = t(30000);

// /offline.html renders exactly one .container > h1; scope to it so a stale
// page shell containing the same word cannot satisfy the assertion.
const offlineHeading = (page: Page) => page.locator("body > div.container h1");

async function expectOfflinePage(page: Page) {
  const heading = offlineHeading(page);
  await expect(heading).toBeVisible({ timeout: ASSERTION_BUDGET });
  await expect(heading).toHaveText(OFFLINE_COPY);
  await expect(page.getByText(ERROR_COPY)).toHaveCount(0);
}

// The app registers the worker on idle, which a busy dev server can starve.
// Register the same script explicitly: this suite tests the worker policy,
// not the idle-deferred registration path. The worker calls clients.claim(),
// so the open page is controlled without an extra reload.
async function registerWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
  });
  await page.waitForFunction(
    async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return !!registration?.active && !!navigator.serviceWorker.controller;
    },
    null,
    { timeout: t(30000) },
  );
}

async function waitForServiceWorker(page: Page) {
  await page.goto("/");
  await registerWorker(page);
}

test("non-home public pages show the offline screen when offline", async ({ page, context }) => {
  test.setTimeout(SW_WAIT_BUDGET + PUBLIC_PAGES.length * ASSERTION_BUDGET + t(30000));
  const manifest = await page.request.get("/manifest.json").catch(() => null);
  expect(manifest?.ok()).toBeTruthy();
  await waitForServiceWorker(page);

  for (const path of PUBLIC_PAGES) {
    await context.setOffline(false);
    await page.goto(path);
    await expect(offlineHeading(page)).toHaveCount(0);
    await expect(page.getByText(ERROR_COPY)).toHaveCount(0);

    await context.setOffline(true);
    await page.reload().catch(() => {});
    await expect(page.locator("body")).not.toBeEmpty();
    await expect(offlineHeading(page)).toHaveCount(1);
    await expectOfflinePage(page);
    await context.setOffline(false);
  }
});

test("home still serves its cached shell when offline", async ({ page, context }) => {
  test.setTimeout(SW_WAIT_BUDGET + ASSERTION_BUDGET + t(30000));
  await waitForServiceWorker(page);
  await page.reload();
  await expect(page.getByText(ERROR_COPY)).toHaveCount(0);

  await context.setOffline(true);
  await page.reload().catch(() => {});
  await expect(page.locator("body")).not.toBeEmpty();
  await expect(offlineHeading(page)).toHaveCount(0);
  await expect(page.getByText(ERROR_COPY)).toHaveCount(0);
  await expect(page.locator("header").first()).toBeVisible();
  // Home's hero is server-rendered into the cached shell; any other public
  // shell has the shared navbar but not this section/h1 pair.
  await expect(page.locator("main section[aria-label] h1[aria-label]").first()).toBeVisible();
  await context.setOffline(false);
});

test("private routes keep the offline screen fallback", async ({ page, context }) => {
  test.setTimeout(SW_WAIT_BUDGET + PRIVATE_PAGES.length * ASSERTION_BUDGET + t(30000));
  await waitForServiceWorker(page);

  for (const path of PRIVATE_PAGES) {
    await context.setOffline(false);
    await page.goto(path);
    await expect(offlineHeading(page)).toHaveCount(0);

    await context.setOffline(true);
    await page.reload().catch(() => {});
    await expect(offlineHeading(page)).toHaveCount(1);
    await expectOfflinePage(page);
    await context.setOffline(false);
  }
});

test("old page-shell cache is purged when the worker activates", async ({ page, context }) => {
  test.setTimeout(SW_WAIT_BUDGET + 3 * ASSERTION_BUDGET + t(30000));
  // Block the app's deferred registration until a stale v14 cache exists.
  await context.route("**/sw.js", (route) => route.abort());
  await page.goto("/");
  await page.evaluate(async () => {
    const cache = await caches.open("ndjourney-v14");
    await cache.put(
      "/gallery",
      new Response("stale public shell", { headers: { "Content-Type": "text/html" } }),
    );
  });
  await context.unroute("**/sw.js");
  await registerWorker(page);

  // controller can be set while activate's waitUntil cleanup is still running.
  await expect
    .poll(async () => page.evaluate(() => caches.keys()), { timeout: ASSERTION_BUDGET })
    .not.toContain("ndjourney-v14");

  await context.setOffline(true);
  await page.goto("/gallery").catch(() => {});
  await expect(offlineHeading(page)).toHaveCount(1);
  await expectOfflinePage(page);
  await context.setOffline(false);
});
