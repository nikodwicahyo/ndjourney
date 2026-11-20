import { describe, expect, it } from "vitest";
import { toLocationFix, type NativePosition } from "@/lib/location/native-fix";

const POS: NativePosition = {
  latitude: -6.2,
  longitude: 106.8,
  accuracy: 12,
  altitude: 25,
  bearing: 90,
  speed: 1.4,
  time: 1_700_000_000_000,
};

describe("toLocationFix (native plugin -> server contract)", () => {
  it("maps plugin fields, including bearing -> heading and time -> recordedAt", () => {
    const fix = toLocationFix(POS, { isActive: true, now: 1_800_000_000_000 });
    expect(fix).toMatchObject({
      latitude: -6.2,
      longitude: 106.8,
      accuracy: 12,
      altitude: 25,
      heading: 90,
      speed: 1.4,
      source: "native",
      trackingState: "foreground",
      deviceType: "mobile",
      recordedAt: new Date(1_700_000_000_000).toISOString(),
    });
    expect(fix?.clientId).toMatch(/^[\w-]{8,64}$/);
  });

  it("marks a backgrounded app and prefers battery-saver when low", () => {
    expect(toLocationFix(POS, { isActive: false })?.trackingState).toBe("background");
    expect(
      toLocationFix(POS, { isActive: false, batteryLow: true })?.trackingState,
    ).toBe("battery-saver");
  });

  it("falls back to now for a missing or invalid plugin timestamp", () => {
    const now = 1_800_000_000_000;
    expect(toLocationFix({ ...POS, time: null }, { isActive: true, now })?.recordedAt).toBe(
      new Date(now).toISOString(),
    );
    expect(toLocationFix({ ...POS, time: Number.NaN }, { isActive: true, now })?.recordedAt).toBe(
      new Date(now).toISOString(),
    );
  });

  it("normalises non-finite optional fields to null", () => {
    const fix = toLocationFix(
      { latitude: 1, longitude: 2, accuracy: Number.NaN, bearing: null, speed: undefined, altitude: Infinity },
      { isActive: true, deviceType: "tablet" },
    );
    expect(fix).toMatchObject({
      accuracy: null,
      heading: null,
      speed: null,
      altitude: null,
      deviceType: "tablet",
    });
  });

  it("drops unusable positions instead of posting garbage", () => {
    expect(toLocationFix(undefined, { isActive: true })).toBeNull();
    expect(toLocationFix({ latitude: Number.NaN, longitude: 1 }, { isActive: true })).toBeNull();
    expect(toLocationFix({ longitude: 1 }, { isActive: true })).toBeNull();
    expect(toLocationFix({ latitude: 1 }, { isActive: true })).toBeNull();
  });
});
