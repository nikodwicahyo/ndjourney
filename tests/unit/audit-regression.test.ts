import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createLetterSchema } from "@/lib/validations/letter";
import { canManageCoupleRow } from "@/lib/couple-ownership";

const recipientId = "ck12345678901234567890123";
const base = {
  title: "Hai",
  content: "<p>cinta</p>",
  recipientId,
  mood: "LOVE" as const,
};

describe("audit regression: time-capsule unlockAt", () => {
  it("rejects capsule without future unlockAt", () => {
    expect(
      createLetterSchema.safeParse({ ...base, isTimeCapsule: true }).success,
    ).toBe(false);
    expect(
      createLetterSchema.safeParse({
        ...base,
        isTimeCapsule: true,
        unlockAt: new Date(Date.now() - 1000).toISOString(),
      }).success,
    ).toBe(false);
  });

  it("accepts capsule with future unlockAt, rejects stray unlockAt", () => {
    expect(
      createLetterSchema.safeParse({
        ...base,
        isTimeCapsule: true,
        unlockAt: new Date(Date.now() + 3600_000).toISOString(),
      }).success,
    ).toBe(true);
    expect(
      createLetterSchema.safeParse({
        ...base,
        isTimeCapsule: false,
        unlockAt: new Date(Date.now() + 3600_000).toISOString(),
      }).success,
    ).toBe(false);
  });

  it("caps letter content length", () => {
    expect(
      createLetterSchema.safeParse({ ...base, content: "a".repeat(50001) }).success,
    ).toBe(false);
  });

  it("does not carry the dead isPublic flag", () => {
    const parsed = createLetterSchema.parse({ ...base, isPublic: true });
    expect("isPublic" in parsed).toBe(false);
  });
});

describe("audit regression: orphan row ownership", () => {
  const ME = "user-me";
  const COUPLE = "couple-1";

  it("couple rows belong to that couple only", () => {
    expect(canManageCoupleRow({ coupleId: COUPLE }, COUPLE, ME)).toBe(true);
    expect(canManageCoupleRow({ coupleId: "couple-other" }, COUPLE, ME)).toBe(false);
    expect(canManageCoupleRow({ coupleId: COUPLE }, null, ME)).toBe(false);
  });

  it("null-couple rows belong to their creator, never every authed user", () => {
    expect(canManageCoupleRow({ coupleId: null, createdById: ME }, COUPLE, ME)).toBe(true);
    expect(canManageCoupleRow({ coupleId: null, createdById: "other" }, COUPLE, ME)).toBe(false);
    expect(canManageCoupleRow({ coupleId: null, uploadedById: ME }, null, ME)).toBe(true);
    // Unattributed legacy row: locked, not shared.
    expect(canManageCoupleRow({ coupleId: null }, COUPLE, ME)).toBe(false);
  });
});

describe("audit regression: private cache headers", () => {
  it("dashboard HTML is private, no-store in both header layers", () => {
    const nextConfig = readFileSync("next.config.ts", "utf8");
    expect(nextConfig).toContain('source: "/dashboard/:path*"');
    expect(nextConfig).toContain('"private, no-store"');

    const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
    };
    const rule = vercel.headers.find((h) => h.source === "/dashboard/(.*)");
    expect(rule?.headers).toContainEqual({
      key: "Cache-Control",
      value: "private, no-store",
    });
  });
});
