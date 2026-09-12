import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {}, sql: undefined }));
import {
  haversineMeters, formatDistance, formatDistanceCategory,
  isMeeting, distanceTrend, formatBearingId, directionEmoji,
} from "@/lib/geo";
import {
  getDaysSince, formatBytes, truncate, seededRandom, pickFromSeed,
  encodeCompositeCursor, decodeCompositeCursor, formatRelativeTime,
  isVideoUrl, isRenderableImageUrl,
} from "@/lib/utils";
import {
  parseJakartaDateOnly, isSameDayJakarta, getJakartaDateOnly,
  getElapsedSince, getAge,
} from "@/lib/date";
import { calculateTargets } from "@/lib/love-meter";
import { getOptimizedImageUrl, getImageSrcSet, getVideoPosterUrl } from "@/lib/cloudinary-urls";
import { CSP_DIRECTIVES } from "@/lib/csp";

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
