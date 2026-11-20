import { describe, it, expect } from "vitest";
import { deriveStatus } from "@/lib/location/status";

const NOW = Date.parse("2026-01-01T12:00:00.000Z");

function iso(secondsAgo: number): string {
  return new Date(NOW - secondsAgo * 1000).toISOString();
}

function base(over: Partial<Parameters<typeof deriveStatus>[0]> = {}) {
  return {
    isSharing: true,
    lastFixAt: iso(5),
    lastSeenAt: iso(5),
    trackingState: "foreground" as const,
    now: NOW,
    ...over,
  };
}

describe("deriveStatus", () => {
  it("reports off when sharing is disabled", () => {
    const s = deriveStatus(base({ isSharing: false }));
    expect(s.kind).toBe("off");
    expect(s.isLive).toBe(false);
  });

  it("reports live for a fix inside the freshness window", () => {
    const s = deriveStatus(base());
    expect(s.kind).toBe("live");
    expect(s.isLive).toBe(true);
    expect(s.ageSeconds).toBe(5);
  });

  it("reports a revoked permission instead of a generic offline", () => {
    const s = deriveStatus(base({ lastFixAt: iso(900), lastSeenAt: iso(2), trackingState: "denied" }));
    expect(s.kind).toBe("no-fix");
    expect(s.reason).toBe("denied");
    expect(s.label).toMatch(/izin/i);
  });

  it("distinguishes 'app open, no GPS' from 'app closed'", () => {
    const s = deriveStatus(base({ lastFixAt: iso(300), lastSeenAt: iso(10) }));
    expect(s.kind).toBe("no-fix");
    expect(s.reason).toBe("gps-off");
  });

  it("reports background when the app is alive but not foreground", () => {
    const s = deriveStatus(base({ lastFixAt: iso(240), lastSeenAt: iso(30), trackingState: "background" }));
    expect(s.kind).toBe("background");
  });

  it("reports app-closed when the heartbeat is old but a fix exists", () => {
    const s = deriveStatus(base({ lastFixAt: iso(32_400), lastSeenAt: iso(32_400) }));
    expect(s.kind).toBe("app-closed");
    expect(s.label).toMatch(/lalu/);
  });

  it("reports waiting when there is no fix and no heartbeat yet", () => {
    const s = deriveStatus(base({ lastFixAt: null, lastSeenAt: null }));
    expect(s.kind).toBe("no-fix");
    expect(s.reason).toBe("waiting");
  });

  it("a fresh heartbeat with no fix is 'gps-off', never 'live'", () => {
    const s = deriveStatus(base({ lastFixAt: null, lastSeenAt: iso(3) }));
    expect(s.isLive).toBe(false);
    expect(s.reason).toBe("gps-off");
  });

  it("clamps a future timestamp instead of showing a negative age", () => {
    const s = deriveStatus(base({ lastFixAt: iso(-30), lastSeenAt: iso(-30) }));
    expect(s.ageSeconds).toBe(0);
  });
});
