import { describe, it, expect } from "vitest";
import {
  MOVING_POST_MS,
  STATIONARY_POST_MS,
  deriveMotion,
  isOutlier,
  isValidFix,
  normalizeRecordedAt,
  shouldPost,
  type LocationFix,
  type PostedFix,
} from "@/lib/location";

function fix(overrides: Partial<LocationFix> = {}): LocationFix {
  return {
    latitude: 0,
    longitude: 0,
    accuracy: 10,
    heading: null,
    speed: null,
    altitude: null,
    recordedAt: 1_000_000,
    ...overrides,
  };
}

const posted = (overrides: Partial<PostedFix> = {}): PostedFix => ({
  ...fix(),
  postedAt: 1_000_000,
  ...overrides,
});

describe("location engine", () => {
  it("posts the first fix", () => {
    expect(shouldPost(null, fix(), 1_000_000)).toBe(true);
  });

  it("does not post movement before the 5 s window", () => {
    const last = posted({ latitude: 0, longitude: 0, accuracy: 10, postedAt: 1_000_000 });
    const moved = fix({ latitude: 0.0001, longitude: 0, accuracy: 10 });
    expect(shouldPost(last, moved, 1_000_000 + 2_000)).toBe(false);
  });

  it("posts movement at 5 s with unchanged accuracy", () => {
    const last = posted({ latitude: 0, longitude: 0, accuracy: 10, postedAt: 1_000_000 });
    const moved = fix({ latitude: 0.0001, longitude: 0, accuracy: 10 });
    expect(shouldPost(last, moved, 1_000_000 + MOVING_POST_MS)).toBe(true);
  });

  it("does not post while stationary before the stationary interval", () => {
    const last = posted({ postedAt: 1_000_000 });
    expect(shouldPost(last, fix(), 1_000_000 + 10_000)).toBe(false);
    expect(shouldPost(last, fix(), 1_000_000 + STATIONARY_POST_MS)).toBe(true);
  });

  it("posts a meaningfully better accuracy even without movement", () => {
    const last = posted({ accuracy: 20, postedAt: 1_000_000 });
    expect(shouldPost(last, fix({ accuracy: 10 }), 1_000_000 + 3_000)).toBe(true);
    expect(shouldPost(last, fix({ accuracy: 19 }), 1_000_000 + 3_000)).toBe(false);
  });

  it("rejects a teleport that no vehicle could make", () => {
    const previous = fix({ latitude: 0, longitude: 0, recordedAt: 1_000_000 });
    const jump = fix({ latitude: 1, longitude: 1, recordedAt: 1_001_000 });
    expect(isOutlier(previous, jump)).toBe(true);
  });

  it("clamps a future device clock instead of trusting it", () => {
    const now = 1_000_000;
    expect(normalizeRecordedAt(now + 60 * 60_000, now)).toBe(now + 5 * 60_000);
    expect(normalizeRecordedAt(Number.NaN, now)).toBe(now);
  });

  it("derives speed and heading for history/stops", () => {
    const previous = fix({ latitude: 0, longitude: 0, recordedAt: 1_000_000 });
    const next = deriveMotion(fix({ latitude: 0.0001, longitude: 0, recordedAt: 1_010_000 }), previous);
    expect(next.speed).toBeGreaterThan(0);
    expect(next.heading).not.toBeNull();
  });

  it("rejects out-of-range coordinates", () => {
    expect(isValidFix(fix({ latitude: 200 }))).toBe(false);
    expect(isValidFix(fix())).toBe(true);
  });
});
