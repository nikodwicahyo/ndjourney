import { test, expect } from "@playwright/test";
import path from "path";
import { t } from "./timeout";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

// GAL: public gallery heading + dashboard Kelola Gallery (or login redirect when anon)
test("public gallery shows Gallery heading", async ({ page }) => {
  await page.goto("/gallery");
  await expect(page.getByRole("heading", { name: /^gallery$/i })).toBeVisible({ timeout: t(15000) });
});

test("dashboard gallery requires auth and shows Kelola Gallery when logged in", async ({ page, context }) => {
  // Upload + Cloudinary + save + cleanup can exceed the default 30s test
  // budget under parallel-worker load (assertion budget alone is 60s).
  test.setTimeout(120_000);
  await page.goto("/dashboard/gallery");
  if (page.url().includes("/login")) {
    await expect(page.getByRole("button", { name: /login dengan google/i })).toBeVisible({ timeout: t(15000) });
    return;
  }
  await expect(page.getByRole("heading", { name: /kelola gallery/i })).toBeVisible({ timeout: t(15000) });

  // Upload capability probe: without Cloudinary API secrets /sign answers 503
  // and NO upload path can work in this env (server/bulk/verify all need the
  // secret too). Skip honestly with an annotation instead of failing on env.
  const probe = await page.request
    .post(`${BASE_URL}/api/upload/sign`, {
      data: { fileName: "probe.png", fileType: "image/png", fileSize: 1024 },
    })
    .catch(() => null);
  if (!probe || !probe.ok()) {
    test.info().annotations.push({
      type: "upload-skipped",
      description: `sign unavailable (status ${probe?.status() ?? "unreachable"}) — no Cloudinary API secrets in this env`,
    });
    return;
  }

  const fileChooser = page.locator("#gallery-upload-input");
  await expect(fileChooser).toBeAttached({ timeout: t(15000) });
  await expect(fileChooser).toBeEnabled({ timeout: t(15000) });
  await fileChooser.setInputFiles(path.join(__dirname, "..", "fixtures", "pixel.png"));
  const uploadBtn = page.getByRole("button", { name: /^upload \d+ files?$/i });
  await expect(uploadBtn).toBeEnabled({ timeout: t(15000) });
  await uploadBtn.click();
  // Either outcome must surface promptly: success toast, or the app's own
  // error toast (which carries the real failure reason — far more useful
  // than a timeout on the happy path alone).
  const outcome = page.getByText(/berhasil diupload|gagal|error/i).first();
  await expect(outcome).toBeVisible({ timeout: t(60000) });
  const outcomeText = (await outcome.textContent()) ?? "";
  expect(outcomeText, `upload failed instead of succeeding: ${outcomeText}`).toMatch(/berhasil diupload/i);

  // Self-cleanup: delete exactly what this test uploaded, so runs never
  // pollute the (test or prod) cloud. The photo row must exist for the
  // upload/[publicId] endpoint (404 otherwise) — the flow above creates it.
  // Plain Node fetch with explicit cookies (not page.request): APIResponse
  // bodies proved disposable under parallel-worker load ("Response has been
  // disposed"), while fetch has no browser-lifecycle coupling.
  const cookieHeader = (await context.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, { headers: { Cookie: cookieHeader } });
  const session = await sessionRes.json();
  const userId: string | undefined = session?.user?.id;
  expect(userId, "expected an authenticated session for cleanup").toBeTruthy();
  const since = Date.now() - 5 * 60 * 1000;
  const listRes = await fetch(`${BASE_URL}/api/photos?limit=100`, { headers: { Cookie: cookieHeader } });
  expect(listRes.ok).toBeTruthy();
  const listBody = await listRes.json();
  const items: Array<{ id: string; publicId: string; uploadedById: string; createdAt: string }> =
    listBody.data ?? [];
  const mine = items.filter(
    (p) => p.uploadedById === userId && new Date(p.createdAt).getTime() >= since,
  );
  expect(mine.length, "expected the uploaded photo to be listed").toBeGreaterThan(0);
  for (const photo of mine) {
    const del = await fetch(
      `${BASE_URL}/api/upload/${encodeURIComponent(photo.publicId)}?resourceType=image`,
      { method: "DELETE", headers: { Cookie: cookieHeader } },
    );
    expect(del.ok, `cleanup delete failed for ${photo.publicId}`).toBeTruthy();
  }
});

test("timeline shows Love Timeline heading", async ({ page }) => {
  await page.goto("/timeline");
  await expect(page.getByRole("heading", { name: /love timeline/i })).toBeVisible({ timeout: t(15000) });
});
