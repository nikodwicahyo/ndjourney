import { describe, it, expect } from "vitest";
import { createLetterSchema, updateLetterSchema } from "@/lib/validations/letter";
import { createNoteSchema } from "@/lib/validations/note";
import { updateLocationSchema, updateShareSchema } from "@/lib/validations/location";
import { createMilestoneSchema } from "@/lib/validations/milestone";
import { createQuestionSchema, submitScoreSchema, submitArcadeScoreSchema } from "@/lib/validations/game";
import { createWishSchema } from "@/lib/validations/wish";
import { createPhotoSchema, createAlbumSchema } from "@/lib/validations/photo";
import { updateUserSchema } from "@/lib/validations/user";
import { updateCoupleSchema, cropRectSchema } from "@/lib/validations/couple";

// LTR-02, NOTE-01, LOC-03 + GAM/WISH/TML/PHOTO validation matrix
describe("zod validation contracts", () => {
  it("LTR-02: letter requires title/content/cuid recipient/mood", () => {
    const ok = createLetterSchema.safeParse({
      title: "Hai", content: "<p>cinta</p>",
      recipientId: "ck12345678901234567890123",
      mood: "LOVE", isTimeCapsule: false, isPublic: false,
    });
    // T-01: assert the boolean itself — `ok.success || JSON.stringify(ok)` was
    // tautological (a failure serializes to a truthy string).
    expect(ok.success).toBe(true);
    expect(createLetterSchema.safeParse({ title: "", content: "x", recipientId: "ckabc", mood: "LOVE" }).success).toBe(false);
    expect(createLetterSchema.safeParse({ title: "t", content: "x", recipientId: "not-a-cuid-at-all-123456", mood: "ANGRY" }).success).toBe(false);
    expect(updateLetterSchema.safeParse({ mood: "NOPE" }).success).toBe(false);
  });

  it("NOTE-01: 280 chars pass, 281 fail", () => {
    expect(createNoteSchema.safeParse({ content: "a".repeat(280) }).success).toBe(true);
    expect(createNoteSchema.safeParse({ content: "a".repeat(281) }).success).toBe(false);
    expect(createNoteSchema.safeParse({ content: "" }).success).toBe(false);
  });

  it("LOC-03: lat/lon/deviceType bounds", () => {
    const base = { latitude: -6.2, longitude: 106.8, deviceType: "mobile" as const };
    expect(updateLocationSchema.safeParse(base).success).toBe(true);
    expect(updateLocationSchema.safeParse({ ...base, latitude: 200 }).success).toBe(false);
    expect(updateLocationSchema.safeParse({ ...base, longitude: 500 }).success).toBe(false);
    expect(updateLocationSchema.safeParse({ latitude: 0, longitude: 0 }).success).toBe(false);
    expect(updateShareSchema.safeParse({ isSharing: true }).success).toBe(true);
    expect(updateShareSchema.safeParse({ isSharing: "yes" }).success).toBe(false);
  });

  it("TML-02: milestone date/color/title", () => {
    const base = { title: "Jadian", date: "2024-02-14", color: "#F43F5E" };
    expect(createMilestoneSchema.safeParse(base).success).toBe(true);
    expect(createMilestoneSchema.safeParse({ ...base, title: "" }).success).toBe(false);
    expect(createMilestoneSchema.safeParse({ ...base, date: "14-02-2024" }).success).toBe(false);
    expect(createMilestoneSchema.safeParse({ ...base, date: "2024-13-99" }).success).toBe(false);
    expect(createMilestoneSchema.safeParse({ ...base, color: "red" }).success).toBe(false);
  });

  it("GAM: discriminated question types", () => {
    expect(createQuestionSchema.safeParse({ type: "WOULD_YOU_RATHER", question: "A?", optionA: "x", optionB: "y", answer: "A" }).success).toBe(true);
    expect(createQuestionSchema.safeParse({ type: "WOULD_YOU_RATHER", question: "A?", optionA: "", optionB: "y", answer: "A" }).success).toBe(false);
    expect(createQuestionSchema.safeParse({ type: "TRIVIA", question: "Q?", answer: "yes" }).success).toBe(true);
    expect(createQuestionSchema.safeParse({ type: "TRUTH_OR_DARE", question: "Q?", category: "Wrong" }).success).toBe(false);
    expect(submitScoreSchema.safeParse({ questionId: "x", isCorrect: true }).success).toBe(false);
    expect(submitArcadeScoreSchema.safeParse({ gameType: "SLIDING_PUZZLE", score: -1 }).success).toBe(false);
    expect(submitArcadeScoreSchema.safeParse({ gameType: "SLIDING_PUZZLE", score: 100 }).success).toBe(true);
  });

  it("WISH/PHOTO/ALBUM contracts", () => {
    expect(createWishSchema.safeParse({ title: "" }).success).toBe(false);
    expect(createWishSchema.safeParse({ title: "Bali", category: "TRAVEL" }).success).toBe(true);
    expect(createWishSchema.safeParse({ title: "x", link: "javascript:alert(1)" }).success).toBe(false);
    expect(createPhotoSchema.safeParse({ url: "https://example.com/a.jpg", publicId: "" }).success).toBe(false);
    expect(createPhotoSchema.safeParse({ url: "https://example.com/a.jpg", publicId: "a/b" }).success).toBe(true);
    expect(createAlbumSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("USER/COUPLE contracts: name/image bounds, date-only refine, crop bounds", () => {
    expect(updateUserSchema.safeParse({}).success).toBe(true);
    expect(updateUserSchema.safeParse({ name: "" }).success).toBe(false);
    expect(updateUserSchema.safeParse({ name: "a".repeat(101) }).success).toBe(false);
    expect(updateUserSchema.safeParse({ image: "javascript:alert(1)" }).success).toBe(false);
    expect(updateUserSchema.safeParse({ image: "https://x.com/a.jpg" }).success).toBe(true);
    expect(updateCoupleSchema.safeParse({ anniversaryDate: "2024-02-14" }).success).toBe(true);
    expect(updateCoupleSchema.safeParse({ anniversaryDate: "14-02-2024" }).success).toBe(false);
    expect(updateCoupleSchema.safeParse({ anniversaryDate: "2024-02-30" }).success).toBe(false);
    expect(updateCoupleSchema.safeParse({ birthDate1: null }).success).toBe(true);
    expect(cropRectSchema.safeParse({ x: 0, y: 0, w: 1, h: 1 }).success).toBe(true);
    expect(cropRectSchema.safeParse({ x: 0.9, y: 0, w: 0.2, h: 0.2 }).success).toBe(false);
    expect(updateCoupleSchema.safeParse({ heroPhotoUrl: "notaurl" }).success).toBe(false);
  });
});
