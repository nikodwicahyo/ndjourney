import { describe, it, expect, vi, afterEach } from "vitest";
import { estimateArrivalFromRoadDistance } from "@/lib/geo";

afterEach(() => vi.useRealTimers());

describe("estimateArrivalFromRoadDistance", () => {
  it("walks at WALKING_SPEED_MS", () => {
    expect(estimateArrivalFromRoadDistance(5000, "walking")).toBe(Math.round(5000 / 1.4));
  });

  it("cycles at CYCLING_SPEED_MS", () => {
    expect(estimateArrivalFromRoadDistance(5000, "cycling")).toBe(Math.round(5000 / 8.3));
  });

  it("applies the traffic multiplier for driving", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T02:00:00Z")); // 09:00 Jakarta -> 0.85
    expect(estimateArrivalFromRoadDistance(10000, "driving")).toBe(Math.round(10000 / (11.1 * 0.85)));
  });

  it("returns 0 for zero or invalid input", () => {
    expect(estimateArrivalFromRoadDistance(0)).toBe(0);
    expect(estimateArrivalFromRoadDistance(Number.NaN)).toBe(0);
    expect(estimateArrivalFromRoadDistance(-5)).toBe(0);
  });
});
