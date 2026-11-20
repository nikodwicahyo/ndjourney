import { describe, it, expect } from "vitest";
import { shouldPost } from "@/lib/location/gate";
import type { LocationFix } from "@/lib/location/types";

const T0 = Date.parse("2026-01-01T00:00:00.000Z");

function fix(over: Partial<LocationFix> = {}): LocationFix {
  return {
    clientId: "c1",
    latitude: -6.2,
    longitude: 106.8,
    accuracy: 10,
    heading: null,
    speed: null,
    altitude: null,
    deviceType: "mobile",
    recordedAt: new Date(T0).toISOString(),
    trackingState: "foreground",
    source: "web",
    ...over,
  };
}

describe("shouldPost", () => {
  it("posts the first fix", () => {
    expect(shouldPost(null, fix(), T0)).toBe(true);
  });

  it("posts when the device moved >= 5 m even with unchanged accuracy", () => {
    // Regression: the old accuracy-only gate froze the position of a moving
    // phone because GPS accuracy rarely improves while walking.
    const prev = fix();
    const next = fix({ latitude: -6.2 + 0.00005 }); // ~5.6 m north
    expect(shouldPost(prev, next, T0 + 1_000)).toBe(true);
  });

  it("does not post when stationary, same accuracy, under 30 s", () => {
    expect(shouldPost(fix(), fix(), T0 + 5_000)).toBe(false);
  });

  it("posts when accuracy improves by at least 15%", () => {
    const prev = fix({ accuracy: 20 });
    const next = fix({ accuracy: 17 }); // 15% better
    expect(shouldPost(prev, next, T0 + 5_000)).toBe(true);
  });

  it("does not post for an accuracy gain smaller than 15%", () => {
    const prev = fix({ accuracy: 20 });
    const next = fix({ accuracy: 18 }); // 10% better
    expect(shouldPost(prev, next, T0 + 5_000)).toBe(false);
  });

  it("posts after 30 s even when completely stationary", () => {
    expect(shouldPost(fix(), fix(), T0 + 30_000)).toBe(true);
  });

  it("posts when either accuracy is unknown but 30 s elapsed", () => {
    const prev = fix({ accuracy: null });
    const next = fix({ accuracy: null });
    expect(shouldPost(prev, next, T0 + 5_000)).toBe(false);
    expect(shouldPost(prev, next, T0 + 30_000)).toBe(true);
  });

  it("does not post a slightly different fix inside the throttle window", () => {
    const prev = fix();
    const next = fix({ latitude: -6.20001 }); // ~1.1 m
    expect(shouldPost(prev, next, T0 + 8_000)).toBe(false);
  });
});
