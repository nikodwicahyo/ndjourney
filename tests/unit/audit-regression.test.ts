import { describe, it, expect } from "vitest";
import { createLetterSchema } from "@/lib/validations/letter";

const recipientId = "ck12345678901234567890123";
const base = {
  title: "Hai",
  content: "<p>cinta</p>",
  recipientId,
  mood: "LOVE" as const,
  isPublic: false,
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
});
