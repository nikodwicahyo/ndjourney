import { describe, it, expect, vi } from "vitest";
import {
  checkActiveShare,
  isPlausibleFix,
  parseJsonBody,
  shareError,
  MAX_PLAUSIBLE_SPEED_MPS,
} from "@/lib/location/server";
import {
  batchLocationSchema,
  locationStatusSchema,
  updateLocationSchema,
  updateShareSchema,
} from "@/lib/validations/location";

const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const at = (ms: number) => new Date(T0 + ms);

describe("checkActiveShare", () => {
  function tx(share: Record<string, unknown> | null) {
    return {
      locationShare: {
        findUnique: vi.fn(async () => share),
        update: vi.fn(async () => ({})),
      },
      userLocation: { deleteMany: vi.fn(async () => ({ count: 1 })) },
    };
  }

  it("passes an active, unexpired share", async () => {
    const db = tx({ coupleId: "c1", isSharing: true, expiresAt: null, trackingState: "foreground" });
    expect(await checkActiveShare(db as never, "u1", at(0))).toEqual({
      ok: true,
      coupleId: "c1",
      trackingState: "foreground",
    });
  });

  it("lazily opts out an expired share and clears the live pin", async () => {
    const db = tx({ coupleId: "c1", isSharing: true, expiresAt: at(-1000), trackingState: "foreground" });
    expect(await checkActiveShare(db as never, "u1", at(0))).toEqual({ ok: false, code: "expired" });
    // Opt-out must COMMIT in the caller's tx — that is why the gate returns
    // instead of throwing. A throw would roll it back and strand the share.
    expect(db.locationShare.update).toHaveBeenCalledWith({
      where: { userId: "u1" },
      data: { isSharing: false, expiresAt: null, trackingState: "stopped" },
    });
    expect(db.userLocation.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
  });

  it("fails closed for a disabled or missing share", async () => {
    expect(await checkActiveShare(tx({ isSharing: false }) as never, "u1", at(0))).toEqual({
      ok: false,
      code: "disabled",
    });
    expect(await checkActiveShare(tx(null) as never, "u1", at(0))).toEqual({
      ok: false,
      code: "disabled",
    });
  });
});

describe("isPlausibleFix", () => {
  const prev = { latitude: -6.2, longitude: 106.8, updatedAt: at(0) };

  it("accepts normal movement", () => {
    // ~11 m over 10 s.
    expect(isPlausibleFix(prev, { latitude: -6.2, longitude: 106.8001 }, at(10_000))).toBe(true);
  });

  it("rejects an impossible teleport", () => {
    expect(isPlausibleFix(prev, { latitude: -6.9, longitude: 107.5 }, at(10_000))).toBe(false);
  });

  it("accepts out-of-order fixes (dedupe, not teleport)", () => {
    expect(isPlausibleFix(prev, { latitude: -6.9, longitude: 107.5 }, at(-10_000))).toBe(true);
  });

  it("uses a speed ceiling above any commercial aircraft", () => {
    // 100 m/s = 360 km/h, above any commercial aircraft's ground speed.
    expect(MAX_PLAUSIBLE_SPEED_MPS).toBe(100);
  });
});

describe("parseJsonBody", () => {
  const json = JSON.stringify({ latitude: -6.2 });

  it("parses an application/json request", async () => {
    const req = new Request("http://localhost/api/location", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: json,
    });
    expect(await parseJsonBody(req)).toEqual({ latitude: -6.2 });
  });

  it("parses a text/plain sendBeacon body", async () => {
    const req = new Request("http://localhost/api/location", {
      method: "POST",
      headers: { "content-type": "text/plain;charset=UTF-8" },
      body: json,
    });
    expect(await parseJsonBody(req)).toEqual({ latitude: -6.2 });
  });

  it("returns null for malformed JSON", async () => {
    const req = new Request("http://localhost/api/location", { method: "POST", body: "{" });
    expect(await parseJsonBody(req)).toBeNull();
  });
});

describe("shareError", () => {
  it("maps disabled/expired to distinct 403 codes", () => {
    expect(shareError("disabled").status).toBe(403);
    expect(shareError("disabled").body.code).toBe("disabled");
    expect(shareError("expired").body.code).toBe("expired");
  });
});

describe("location validation boundaries", () => {
  const fix = {
    latitude: -6.2,
    longitude: 106.8,
    deviceType: "mobile" as const,
  };

  it("accepts a single fix and rejects >50 in a batch", () => {
    expect(updateLocationSchema.safeParse(fix).success).toBe(true);
    expect(batchLocationSchema.safeParse({ fixes: Array.from({ length: 51 }, () => fix) }).success).toBe(false);
    expect(batchLocationSchema.safeParse({ fixes: Array.from({ length: 50 }, () => fix) }).success).toBe(true);
  });

  it("rejects a fix timestamp too far in the future", () => {
    const future = new Date(Date.now() + 10 * 60_000).toISOString();
    expect(updateLocationSchema.safeParse({ ...fix, recordedAt: future }).success).toBe(false);
  });

  it("accepts only the three share durations or null", () => {
    expect(updateShareSchema.safeParse({ isSharing: true, durationMinutes: 15 }).success).toBe(true);
    expect(updateShareSchema.safeParse({ isSharing: true, durationMinutes: 60 }).success).toBe(true);
    expect(updateShareSchema.safeParse({ isSharing: true, durationMinutes: 480 }).success).toBe(true);
    expect(updateShareSchema.safeParse({ isSharing: true, durationMinutes: null }).success).toBe(true);
    expect(updateShareSchema.safeParse({ isSharing: true, durationMinutes: 30 }).success).toBe(false);
  });

  it("requires a known tracking state on the heartbeat", () => {
    expect(locationStatusSchema.safeParse({ trackingState: "gps-off" }).success).toBe(true);
    expect(locationStatusSchema.safeParse({ trackingState: "bogus" }).success).toBe(false);
  });
});
