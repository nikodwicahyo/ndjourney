import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import path from "path";
import { t } from "./timeout";

// Partner-A realtime bell: A uploads a photo, B's bell must update without a
// reload (Pusher), and A's own bell must NOT count their own activity (the
// /api/notifications query filters actorId != me). OS toast delivery is
// deliberately not asserted here — service-worker push is covered elsewhere.
//
// Needs two seeded partners + Cloudinary + Pusher. Locally Playwright does not
// read .env.test, so without explicit env the file skips instead of failing.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

const A_EMAIL = process.env.TEST_USER_EMAIL || "";
const A_PASSWORD = process.env.TEST_USER_PASSWORD || "";
const B_EMAIL = process.env.TEST_PARTNER_EMAIL || "";
const B_PASSWORD = process.env.TEST_PARTNER_PASSWORD || "";

const MISSING = [
  !(A_EMAIL && A_PASSWORD) && "TEST_USER_EMAIL/TEST_USER_PASSWORD",
  !(B_EMAIL && B_PASSWORD) && "TEST_PARTNER_EMAIL/TEST_PARTNER_PASSWORD",
].filter((name): name is string => Boolean(name));

test.skip(
  MISSING.length > 0,
  `partner realtime bell needs ${MISSING.join(" and ")} (plus a seeded partner B in A's couple)`,
);

// Same flow as auth.setup.ts: settle for hydration before clicking, then
// require the strict /dashboard path so the login bounce can never pass.
async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`);
  await expect(page.getByPlaceholder("nama@email.com")).toBeVisible({ timeout: t(15000) });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder("nama@email.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: /^masuk|login$/i }).first().click();
  await expect(page).toHaveURL(/\/dashboard\/?(\?|#|$)/, { timeout: t(20000) });
}

function badgeCount(label: string | null): number {
  const match = /(\d+) belum dibaca/.exec(label ?? "");
  return match ? Number(match[1]) : 0;
}

// Best-effort: remove exactly what this run uploaded so the cloud is not
// polluted when assertions fail before the happy path finishes.
async function cleanupUploaded(context: BrowserContext, since: number) {
  try {
    const cookieHeader = (await context.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
    const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, { headers: { Cookie: cookieHeader } });
    const userId: string | undefined = (await sessionRes.json())?.user?.id;
    if (!userId) return;

    const listRes = await fetch(`${BASE_URL}/api/photos?limit=100`, { headers: { Cookie: cookieHeader } });
    if (!listRes.ok) return;
    const items: Array<{ publicId: string; uploadedById: string; createdAt: string }> =
      (await listRes.json())?.data ?? [];

    for (const photo of items) {
      if (photo.uploadedById !== userId || new Date(photo.createdAt).getTime() < since) continue;
      await fetch(
        `${BASE_URL}/api/upload/${encodeURIComponent(photo.publicId)}?resourceType=image`,
        { method: "DELETE", headers: { Cookie: cookieHeader } },
      );
    }
  } catch (error) {
    console.warn("[notifications.spec] photo cleanup failed:", error);
  }
}

test("partner A's photo raises partner B's bell in realtime, not A's", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);

  // A is authenticated by the project storageState; on a local run without
  // creds that state is anonymous — skip instead of asserting on a login page.
  const aNotifications = page
    .waitForResponse((res) => res.url().includes("/api/notifications"), { timeout: t(20000) })
    .catch(() => null);
  await page.goto("/dashboard");
  test.skip(
    page.url().includes("/login"),
    "partner A storage state is anonymous — run auth.setup with TEST_USER_EMAIL/TEST_USER_PASSWORD",
  );
  await aNotifications;
  await expect(page.getByRole("button", { name: /^Notifikasi/ })).toBeVisible({ timeout: t(15000) });

  // Every photo path (sign, verify, save) needs Cloudinary secrets; probe the
  // same way gallery.spec.ts does and skip with a reason when they are absent.
  const probe = await page.request
    .post(`${BASE_URL}/api/upload/sign`, {
      data: { fileName: "probe.png", fileType: "image/png", fileSize: 1024 },
    })
    .catch(() => null);
  if (!probe || !probe.ok()) {
    test.skip(
      true,
      `photo upload unavailable (sign status ${probe?.status() ?? "unreachable"}) — no Cloudinary API secrets`,
    );
    return;
  }

  const aBell = page.getByRole("button", { name: /^Notifikasi/ });
  const aBefore = badgeCount(await aBell.getAttribute("aria-label"));

  const bContext = await browser.newContext({ baseURL: BASE_URL });
  let uploadedSince: number | null = null;
  try {
    const bPage = await bContext.newPage();
    // Subscribe before login navigates B to the dashboard, so the private
    // channel handshake cannot be missed.
    const pusherAuth = bPage
      .waitForResponse((res) => res.url().includes("/api/pusher/auth"), { timeout: t(20000) })
      .catch(() => null);
    const bNotifications = bPage
      .waitForResponse((res) => res.url().includes("/api/notifications"), { timeout: t(20000) })
      .catch(() => null);

    await login(bPage, B_EMAIL, B_PASSWORD);
    const bBell = bPage.getByRole("button", { name: /^Notifikasi/ });
    await expect(bBell).toBeVisible({ timeout: t(15000) });
    await bNotifications;
    const bBefore = badgeCount(await bBell.getAttribute("aria-label"));

    if (!(await pusherAuth)) {
      test.skip(true, "realtime channel never connected (Pusher unconfigured or unreachable)");
      return;
    }

    // Upload through the app's own gallery UI (sign → Cloudinary → save), which
    // is what emits the activity event that feeds the bell.
    uploadedSince = Date.now() - 5 * 60 * 1000;
    await page.goto("/dashboard/gallery");
    await expect(page.getByRole("heading", { name: /kelola gallery/i })).toBeVisible({ timeout: t(15000) });
    const fileInput = page.locator("#gallery-upload-input");
    await expect(fileInput).toBeAttached({ timeout: t(15000) });
    await expect(fileInput).toBeEnabled({ timeout: t(15000) });
    await fileInput.setInputFiles(path.join(__dirname, "..", "fixtures", "pixel.png"));
    const uploadBtn = page.getByRole("button", { name: /^upload \d+ files?$/i });
    await expect(uploadBtn).toBeEnabled({ timeout: t(15000) });
    await uploadBtn.click();
    const outcome = page.getByText(/berhasil diupload|gagal|error/i).first();
    await expect(outcome).toBeVisible({ timeout: t(60000) });
    const outcomeText = (await outcome.textContent()) ?? "";
    expect(outcomeText, `upload failed instead of succeeding: ${outcomeText}`).toMatch(/berhasil diupload/i);

    // Realtime: B's bell refetches on the activity payload — no reload.
    await expect
      .poll(async () => badgeCount(await bBell.getAttribute("aria-label")), {
        timeout: t(5000),
        message: "partner B's bell never reflected A's photo (Pusher realtime)",
      })
      .toBeGreaterThan(bBefore);

    // Partner-only: the actor's own badge must not move.
    await page.waitForTimeout(1000);
    expect(
      badgeCount(await aBell.getAttribute("aria-label")),
      "uploader's own bell counted their own activity",
    ).toBe(aBefore);
  } finally {
    if (uploadedSince !== null) await cleanupUploaded(page.context(), uploadedSince);
    await bContext.close();
  }
});
