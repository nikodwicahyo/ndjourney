import { describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { id: "u1" } })) }));
// Gate denies before any query — the client must never be constructed here.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const gateMock = vi.hoisted(() => ({
  response: null as NextResponse | null,
}));

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return {
    ...actual,
    withRateLimit: vi.fn(async () => ({
      allowed: false,
      remaining: 0,
      response: gateMock.response,
    })),
  };
});

import { rateLimitConfigs, withRateLimit } from "@/lib/rate-limit";
import { GET as historyGET } from "@/app/api/location/history/route";
import { GET as routeGET } from "@/app/api/route/route";

describe("authenticated read rate limits", () => {
  it("defines bounded buckets for both heavy reads", () => {
    for (const key of ["locationHistory", "route"] as const) {
      const config = rateLimitConfigs[key];
      expect(config.keyPrefix).toMatch(/^location:/);
      expect(config.maxRequests).toBeGreaterThan(0);
      expect(config.windowSeconds).toBeGreaterThan(0);
    }
    // 60s history polling needs headroom, not a hard block.
    expect(rateLimitConfigs.locationHistory.maxRequests).toBeGreaterThan(60);
  });

  it("denies both reads before any DB/OSRM work", async () => {
    gateMock.response = NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
    const history = await historyGET(new Request("http://localhost/api/location/history"));
    const route = await routeGET(
      new Request("http://localhost/api/route?from=-6.2,106.8&to=-6.21,106.81"),
    );
    expect(history.status).toBe(429);
    expect(route.status).toBe(429);
    expect(withRateLimit).toHaveBeenCalledTimes(2);
  });
});
