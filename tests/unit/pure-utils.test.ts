import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {}, sql: undefined }));
import {
  haversineMeters, formatDistance, formatDistanceCategory,
  isMeeting, distanceTrend, formatBearingId, directionEmoji,
} from "@/lib/geo";
import {
  getDaysSince, formatBytes, truncate, seededRandom, pickFromSeed,
  encodeCompositeCursor, decodeCompositeCursor, formatRelativeTime,
  isVideoUrl, isRenderableImageUrl, buildPhotoPayload,
} from "@/lib/utils";
import {
  parseJakartaDateOnly, isSameDayJakarta, getJakartaDateOnly,
  getElapsedSince, getAge,
} from "@/lib/date";
import { calculateTargets } from "@/lib/love-meter";
import { getOptimizedImageUrl, getImageSrcSet, getVideoPosterUrl } from "@/lib/cloudinary-urls";
import { CSP_DIRECTIVES } from "@/lib/csp";
import { parseCropRect, clampCropRect, cropCoverStyle, cropDisplaySrc, cropViewForRect, isFullCrop, FULL_CROP } from "@/lib/image-crop";

// GEO + DATE + UTILS + LOVE-METER + CLOUDINARY-URLS + CSP unit
describe("geo utils", () => {
  const jkt = { latitude: -6.2, longitude: 106.816666 };
  const bdg = { latitude: -6.9175, longitude: 107.6191 };

  it("haversine Jakarta→Bandung ≈ 115km", () => {
    const m = haversineMeters(jkt, bdg);
    expect(m).toBeGreaterThan(100_000);
    expect(m).toBeLessThan(140_000);
  });

  it("same point = 0 + meeting", () => {
    expect(haversineMeters(jkt, jkt)).toBe(0);
    expect(isMeeting(50)).toBe(true);
    expect(isMeeting(101)).toBe(false);
  });

  it("formatDistance/categories/trend", () => {
    expect(formatDistance(500)).toBe("500 m");
    expect(formatDistance(1500)).toContain("km");
    expect(formatDistance(-1)).toBe("—");
    expect(formatDistanceCategory(5)).toBe("Bertemu");
    expect(distanceTrend(90, 100)).toBe("closing");
    expect(distanceTrend(110, 100)).toBe("away");
    expect(distanceTrend(105, 100)).toBe("stable");
    expect(distanceTrend(100, null)).toBeNull();
    expect(["Utara", "Timur Laut", "Timur", "Tenggara", "Selatan", "Barat Daya", "Barat", "Barat Laut"]).toContain(formatBearingId(90));
    expect(typeof directionEmoji(0)).toBe("string");
  });
});

describe("date utils (Asia/Jakarta)", () => {
  it("parseJakartaDateOnly + roundtrip", () => {
    const d = parseJakartaDateOnly("2024-02-14");
    expect(d).toBeInstanceOf(Date);
    expect(getJakartaDateOnly(d!)).toBe("2024-02-14");
    expect(parseJakartaDateOnly("14-02-2024")).toBeNull();
    expect(parseJakartaDateOnly("2024-13-01")).toBeNull();
  });

  it("isSameDayJakarta across timezone boundary", () => {
    expect(isSameDayJakarta("2024-02-14T01:00:00+07:00", "2024-02-14T23:00:00+07:00")).toBe(true);
    expect(isSameDayJakarta("2024-02-14T23:00:00+07:00", "2024-02-15T01:00:00+07:00")).toBe(false);
  });

  it("getElapsedSince/getAge/getDaysSince sane", () => {
    const e = getElapsedSince("2020-01-01T00:00:00+07:00");
    expect(e.years).toBeGreaterThanOrEqual(5);
    expect(getAge("2000-01-01")).toBeGreaterThanOrEqual(20);
    expect(getAge(null)).toBe(0);
    expect(getDaysSince("invalid")).toBe(0);
  });
});

describe("format utils", () => {
  it("isVideoUrl catches extensions AND extensionless delivery paths", () => {
    expect(isVideoUrl("https://x/a.mp4")).toBe(true);
    expect(isVideoUrl("https://x/a.MOV?foo=1")).toBe(true);
    expect(isVideoUrl("https://res.cloudinary.com/x/video/upload/v123/f")).toBe(true);
    expect(isVideoUrl("https://x/a.jpg")).toBe(false);
    expect(isVideoUrl(null)).toBe(false);
  });

  it("isRenderableImageUrl rejects video/heic/empty/non-http", () => {
    expect(isRenderableImageUrl("https://x/a.jpg")).toBe(true);
    expect(isRenderableImageUrl("https://x/a.jpg?w=1")).toBe(true);
    expect(isRenderableImageUrl("https://x/a.mp4")).toBe(false);
    expect(isRenderableImageUrl("https://x/a.heic")).toBe(false);
    expect(isRenderableImageUrl("https://x/a.HEIF")).toBe(false);
    expect(isRenderableImageUrl("")).toBe(false);
    expect(isRenderableImageUrl("data:image/svg+xml,x")).toBe(false);
  });

  it("formatBytes/truncate/seed/cursor/relative", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(truncate("abcdef", 5)).toBe("ab...");
    const rng = seededRandom(42);
    expect(rng()).toBeGreaterThanOrEqual(0);
    expect(pickFromSeed(["a", "b"], 1)).toMatch(/^[ab]$/);
    const c = encodeCompositeCursor(new Date("2024-01-01T00:00:00Z"), "abc");
    expect(decodeCompositeCursor(c)).toEqual({ createdAt: "2024-01-01T00:00:00.000Z", id: "abc" });
    expect(decodeCompositeCursor("!!!")).toBeNull();
    expect(formatRelativeTime(new Date(Date.now() - 1000))).toBe("baru saja");
  });

  it("buildPhotoPayload classifies webm/avi/extensionless video (not mp4|mov only)", () => {
    const base = { url: "", publicId: "ndjourney-web/u/a", bytes: 8 };
    expect(buildPhotoPayload({ ...base, url: "https://x/a.webm" }).isVideo).toBe(true);
    expect(buildPhotoPayload({ ...base, url: "https://x/a.avi" }).isVideo).toBe(true);
    expect(buildPhotoPayload({ ...base, url: "https://res.cloudinary.com/x/video/upload/v1/f" }).isVideo).toBe(true);
    expect(buildPhotoPayload({ ...base, url: "https://x/a.jpg" }).isVideo).toBe(false);
    expect(buildPhotoPayload({ ...base, url: "https://x/a.jpg" }, "al1", true)).toMatchObject({ albumId: "al1", isPublic: true });
  });

  it("buildPhotoPayload omits unset keys (explicit nulls 400 createPhotoSchema)", async () => {
    const { createPhotoSchema } = await import("@/lib/validations/photo");
    const bare = buildPhotoPayload({
      url: "https://res.cloudinary.com/t/image/upload/v1/a.jpg",
      publicId: "ndjourney-web/u1/a",
      bytes: 8,
    });
    expect("albumId" in bare).toBe(false);
    expect("thumbnailUrl" in bare).toBe(false);
    expect(createPhotoSchema.safeParse(bare).success).toBe(true);
    const full = buildPhotoPayload(
      {
        url: "https://res.cloudinary.com/t/image/upload/v1/a.jpg",
        publicId: "ndjourney-web/u1/a",
        thumbnailUrl: "https://res.cloudinary.com/t/image/upload/t.jpg",
        width: 100,
        height: 100,
        bytes: 8,
      },
      "ck12345678901234567890123",
      true,
    );
    expect(createPhotoSchema.safeParse(full).success).toBe(true);
  });

  it("buildPhotoPayload carries no takenAt (upload date is createdAt)", async () => {
    const { createPhotoSchema } = await import("@/lib/validations/photo");
    const payload = buildPhotoPayload({
      url: "https://res.cloudinary.com/t/image/upload/v1/a.jpg",
      publicId: "ndjourney-web/u1/a",
      bytes: 8,
    });
    expect("takenAt" in payload).toBe(false);
    expect(createPhotoSchema.safeParse(payload).success).toBe(true);
  });
});

describe("love-meter targets", () => {
  it("zero → 3, scales monotonically", () => {
    const z = calculateTargets({ milestoneCount: 0, noteCount: 0, letterCount: 0, photoCount: 0 });
    expect(z).toEqual({ targetMilestones: 3, targetNotes: 3, targetLetters: 3, targetPhotos: 3 });
    const big = calculateTargets({ milestoneCount: 100, noteCount: 100, letterCount: 100, photoCount: 100 });
    const mid = calculateTargets({ milestoneCount: 10, noteCount: 10, letterCount: 10, photoCount: 10 });
    expect(big.targetPhotos).toBeGreaterThan(mid.targetPhotos);
    expect(mid.targetPhotos).toBeGreaterThan(z.targetPhotos);
  });
});

describe("cloudinary urls", () => {
  const img = "https://res.cloudinary.com/demo/image/upload/v1/folder/a.jpg";
  it("injects transform, passes through non-cloudinary", () => {
    const out = getOptimizedImageUrl(img, 800);
    expect(out).toContain("w_800");
    expect(out).toContain("q_auto");
    expect(getOptimizedImageUrl("https://example.com/a.jpg")).toBe("https://example.com/a.jpg");
    expect(getImageSrcSet(img)).toContain("320w");
    expect(getVideoPosterUrl("https://res.cloudinary.com/demo/video/upload/v1/folder/a.mp4")).toContain("/image/upload/");
  });
});

describe("csp single-source", () => {
  it("contains required directives", () => {
    const s = CSP_DIRECTIVES.join("; ");
    for (const d of ["default-src 'self'", "frame-ancestors 'none'", "report-uri /api/csp-violation", "worker-src 'self' blob:"]) {
      expect(s).toContain(d);
    }
  });
});

describe("image-crop rect math", () => {
  it("parseCropRect accepts valid, rejects garbage without throwing", () => {
    expect(parseCropRect({ x: 0, y: 0, w: 1, h: 1 })).toEqual(FULL_CROP);
    expect(parseCropRect({ x: 0.1, y: 0.2, w: 0.5, h: 0.4 })).toBeTruthy();
    for (const bad of [null, undefined, "x", [], { x: 0, y: 0, w: 0, h: 1 }, { x: 0, y: 0, w: 1.5, h: 1 }, { x: 0.9, y: 0, w: 0.2, h: 1 }, { x: NaN, y: 0, w: 1, h: 1 }]) {
      expect(parseCropRect(bad)).toBeNull();
    }
  });

  it("cropCoverStyle: full rect == object-cover, sub-rect covers frame", () => {
    const full = cropCoverStyle(1600, 900, 1440, 810, FULL_CROP);
    expect(full).toMatchObject({ width: 1440, height: 810, left: 0, top: 0 });
    const sub = cropCoverStyle(1000, 1000, 1600, 900, { x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
    expect(sub).toMatchObject({ width: 3200, height: 3200, left: -800 });
    // Rendered image always covers the frame (no gaps).
    expect(sub!.width).toBeGreaterThanOrEqual(1600);
    expect(sub!.height).toBeGreaterThanOrEqual(900);
    expect(cropCoverStyle(0, 100, 100, 100, FULL_CROP)).toBeNull();
  });

  it("clampCropRect keeps rect inside bounds", () => {
    expect(clampCropRect({ x: -1, y: 2, w: 5, h: 0 })).toEqual({ x: 0, y: 0.99, w: 1, h: 0.01 });
  });

  it("cropDisplaySrc: a crop always renders from the ORIGINAL, never the square thumb", () => {
    // Cloudinary thumbs are 400x400 center-fills — original-space rects don't map onto them.
    const sub = { x: 0.1, y: 0, w: 0.75, h: 1 };
    expect(cropDisplaySrc("o.jpg", "t.jpg", sub)).toBe("o.jpg");
    expect(cropDisplaySrc("o.jpg", "t.jpg", FULL_CROP)).toBe("o.jpg");
    // No crop → cheap thumb; missing thumb → original.
    expect(cropDisplaySrc("o.jpg", "t.jpg", null)).toBe("t.jpg");
    expect(cropDisplaySrc("o.jpg", null, null)).toBe("o.jpg");
    expect(cropDisplaySrc("o.jpg", undefined, null)).toBe("o.jpg");
  });

  it("cropViewForRect: view window reproduces the saved rect exactly (round-trip)", () => {
    // Same-aspect case (timeline 1:1): window == the rect that was saved.
    const nw = 4000, nh = 3000, fw = 300, fh = 300;
    const saved = { x: 0.125, y: 0, w: 0.75, h: 1 };
    const cover = Math.max(fw / nw, fh / nh);
    const v = cropViewForRect(saved, nw, nh, fw, fh)!;
    const w = fw / (nw * cover * v.zoom);
    const h = fh / (nh * cover * v.zoom);
    expect(v.cx - w / 2).toBeCloseTo(saved.x, 6);
    expect(v.cy - h / 2).toBeCloseTo(saved.y, 6);
    expect(w).toBeCloseTo(saved.w, 6);
    expect(h).toBeCloseTo(saved.h, 6);
  });

  it("cropViewForRect: legacy cross-aspect rect cover-fits into the frame (16:9 wish)", () => {
    // 6:1 rect (cropped back when wishes were 3:1) shown in a 16:9 frame.
    const nw = 3000, nh = 1000, fw = 1600, fh = 900;
    const legacy = { x: 0.1, y: 0.2, w: 0.6, h: 0.3 };
    const v = cropViewForRect(legacy, nw, nh, fw, fh)!;
    const cover = Math.max(fw / nw, fh / nh);
    const w = fw / (nw * cover * v.zoom);
    const h = fh / (nh * cover * v.zoom);
    // Window keeps the frame's 16:9 in IMAGE pixels (what cropCoverStyle shows).
    expect((w * nw) / (h * nh)).toBeCloseTo(fw / fh, 6);
    // Maximal + centered inside the saved rect, so it never shows outside it.
    const e = 1e-9;
    expect(v.cx - w / 2).toBeGreaterThanOrEqual(legacy.x - e);
    expect(v.cx + w / 2).toBeLessThanOrEqual(legacy.x + legacy.w + e);
    expect(v.cy - h / 2).toBeGreaterThanOrEqual(legacy.y - e);
    expect(v.cy + h / 2).toBeLessThanOrEqual(legacy.y + legacy.h + e);
    expect(h).toBeCloseTo(legacy.h, 6); // height-limited leg here: full rect height kept
  });

  it("cropViewForRect: full rect is zoom 1, junk inputs are null", () => {
    const v = cropViewForRect(FULL_CROP, 3000, 2000, 1600, 900)!;
    expect(v.zoom).toBeCloseTo(1, 6);
    expect(v.cx).toBeCloseTo(0.5, 6);
    expect(cropViewForRect(FULL_CROP, 0, 100, 100, 100)).toBeNull();
    expect(cropViewForRect(FULL_CROP, 100, 100, 0, 56)).toBeNull();
  });

  it("isFullCrop: full rect skips the bake, any inset bakes", () => {
    expect(isFullCrop(FULL_CROP)).toBe(true);
    expect(isFullCrop({ x: 0, y: 0, w: 1, h: 1 })).toBe(true);
    expect(isFullCrop({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 })).toBe(false);
  });
});
