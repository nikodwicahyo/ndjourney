import { describe, it, expect } from "vitest";
import { buildHistoryView, stopOrdinalLabel } from "@/lib/history-view";
import type { LocationHistoryPoint } from "@/hooks/useLocation";

const SELF = "self";
const PARTNER = "partner";

function point(
  userId: string,
  latitude: number,
  longitude: number,
  minutesAgo: number,
  accuracy = 10,
): LocationHistoryPoint {
  return {
    userId,
    latitude,
    longitude,
    accuracy,
    heading: null,
    speed: null,
    createdAt: new Date(Date.UTC(2026, 10, 21, 10, 0) - minutesAgo * 60_000).toISOString(),
    deviceType: "mobile",
  };
}

describe("history view", () => {
  it("splits a long silence at a different place instead of drawing a line", () => {
    const view = buildHistoryView([
      point(SELF, -6.2, 106.8, 60),
      point(SELF, -6.4, 106.9, 30),
      point(SELF, -6.6, 107.0, 0),
    ], { selfId: SELF })!;

    expect(view.self.segments).toHaveLength(3);
  });

  it("keeps a long silence at the same place in one segment", () => {
    const view = buildHistoryView([
      point(SELF, -6.2, 106.8, 60),
      point(SELF, -6.2, 106.8, 30),
      point(SELF, -6.2, 106.8, 0),
    ], { selfId: SELF })!;

    expect(view.self.segments).toHaveLength(1);
  });

  it("splits a teleport and keeps the following points together", () => {
    const view = buildHistoryView([
      point(SELF, -6.2, 106.8, 10),
      point(SELF, -6.3, 106.9, 9.99),
      point(SELF, -6.3, 106.9, 9.98),
    ], { selfId: SELF })!;

    expect(view.self.segments.length).toBeGreaterThanOrEqual(2);
  });

  it("drops duplicate replayed fixes", () => {
    const view = buildHistoryView([
      point(SELF, -6.2, 106.8, 10),
      point(SELF, -6.2, 106.8, 10),
    ], { selfId: SELF })!;

    expect(view.self.points).toHaveLength(1);
  });

  it("applies the same user filter to trail and stops", () => {
    const points = [
      point(SELF, -6.2, 106.8, 60),
      point(SELF, -6.2, 106.8, 30),
      point(PARTNER, -6.3, 106.9, 60),
      point(PARTNER, -6.3, 106.9, 30),
    ];

    const all = buildHistoryView(points, { selfId: SELF, filterUser: "all" })!;
    const onlySelf = buildHistoryView(points, { selfId: SELF, filterUser: "self" })!;

    expect(all.self.points.length).toBeGreaterThan(0);
    expect(all.partner.points.length).toBeGreaterThan(0);
    expect(onlySelf.partner.points).toHaveLength(0);
    expect(onlySelf.partner.stops).toHaveLength(0);
    expect(onlySelf.summary.stopCount).toBe(onlySelf.self.stops.length);
  });

  it("returns stable stop ids when an older stop rolls out of the window", () => {
    const older = point(SELF, -6.1, 106.7, 180);
    const rest = [
      point(SELF, -6.2, 106.8, 120),
      point(SELF, -6.2, 106.8, 90),
      point(SELF, -6.2, 106.8, 60),
    ];

    const first = buildHistoryView([older, ...rest], { selfId: SELF })!;
    const second = buildHistoryView([...rest], { selfId: SELF })!;

    const surviving = first.self.stops.find(
      (s) => s.arrivedAt === rest[0].createdAt,
    )!;
    expect(second.self.stops).toHaveLength(1);
    expect(surviving.id).toBe(second.self.stops[0].id);
  });

  it("uses one ordinal label for the map and the card", () => {
    expect(stopOrdinalLabel(0)).toBe("Kunjungan #1");
    expect(stopOrdinalLabel(4)).toBe("Kunjungan #5");
  });
});
