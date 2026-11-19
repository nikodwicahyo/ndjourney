import { describe, it, expect } from "vitest";
import {
  estimateRoadArrivalSeconds,
  WALKING_SPEED_MS,
  CYCLING_SPEED_MS,
  DRIVING_SPEED_MS,
} from "@/lib/geo";

const route = (durationSeconds: number | null = 900) => ({
  distanceMeters: 10000,
  durationSeconds,
});

describe("estimateRoadArrivalSeconds (road-only)", () => {
  it("uses OSRM driving duration for a car when available", () => {
    expect(estimateRoadArrivalSeconds(route(1234), "driving")).toBe(1234);
  });

  it("scales the same road distance by walking / motor speed", () => {
    expect(estimateRoadArrivalSeconds(route(), "walking")).toBe(
      Math.round(10000 / WALKING_SPEED_MS),
    );
    expect(estimateRoadArrivalSeconds(route(), "cycling")).toBe(
      Math.round(10000 / CYCLING_SPEED_MS),
    );
  });

  it("gives clearly different ETAs per mode from the same road route", () => {
    const r = route();
    const walk = estimateRoadArrivalSeconds(r, "walking");
    const motor = estimateRoadArrivalSeconds(r, "cycling");
    const car = estimateRoadArrivalSeconds(r, "driving");
    expect(walk).toBeGreaterThan(motor);
    expect(motor).toBeGreaterThan(car);
  });

  it("falls back to road distance / driving speed when duration is missing", () => {
    expect(estimateRoadArrivalSeconds(route(null), "driving")).toBe(
      Math.round(10000 / DRIVING_SPEED_MS),
    );
  });

  it("returns 0 for a missing or invalid route", () => {
    expect(estimateRoadArrivalSeconds(null)).toBe(0);
    expect(estimateRoadArrivalSeconds(undefined, "driving")).toBe(0);
    expect(estimateRoadArrivalSeconds({ distanceMeters: 0, durationSeconds: 5 })).toBe(0);
    expect(
      estimateRoadArrivalSeconds({ distanceMeters: Number.NaN, durationSeconds: 5 }),
    ).toBe(0);
    expect(estimateRoadArrivalSeconds({ distanceMeters: -5, durationSeconds: 5 })).toBe(0);
  });
});
