import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  detectStopPoints,
  formatDurationId,
  formatTimeOnly,
  downsampleWaypoints,
  fetchRoadSnappedRoute,
} from "@/lib/location-history";
import type { LocationHistoryPoint } from "@/hooks/useLocation";

describe("location-history utility", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("formatDurationId", () => {
    it("formats minutes correctly in Indonesian", () => {
      expect(formatDurationId(0)).toBe("< 1 mnt");
      expect(formatDurationId(0.5)).toBe("< 1 mnt");
      expect(formatDurationId(15)).toBe("15 mnt");
      expect(formatDurationId(60)).toBe("1 jam");
      expect(formatDurationId(90)).toBe("1 jam 30 mnt");
      expect(formatDurationId(125)).toBe("2 jam 5 mnt");
    });
  });

  describe("formatTimeOnly", () => {
    it("formats ISO string to HH:mm", () => {
      const res = formatTimeOnly("2026-11-20T08:30:00Z");
      expect(res).toMatch(/\d{2}[:.]\d{2}/);
    });

    it("handles invalid string gracefully", () => {
      expect(formatTimeOnly("invalid")).toBe("—");
    });
  });

  describe("downsampleWaypoints", () => {
    it("returns short paths intact", () => {
      const pts = [{ lat: -6.2, lng: 106.81 }, { lat: -6.21, lng: 106.82 }];
      expect(downsampleWaypoints(pts)).toEqual(pts);
    });

    it("filters out coordinates that are too close together", () => {
      // 10 coordinates clustered within 5 meters
      const pts = Array.from({ length: 10 }, (_, i) => ({
        lat: -6.2 + i * 0.00001, // ~1 meter apart
        lng: 106.81,
      }));
      const res = downsampleWaypoints(pts, 35);
      expect(res.length).toBeLessThan(pts.length);
      expect(res[0]).toEqual(pts[0]);
      expect(res[res.length - 1]).toEqual(pts[pts.length - 1]);
    });
  });

  describe("detectStopPoints", () => {
    it("returns empty array for empty input", () => {
      expect(detectStopPoints([])).toEqual([]);
    });

    it("clusters stationary points into a visited stop", () => {
      const baseTime = new Date("2026-11-20T10:00:00Z").getTime();
      const points: LocationHistoryPoint[] = [
        // Stop 1: Cafe (stayed 30 mins)
        {
          userId: "user-1",
          latitude: -6.2000,
          longitude: 106.8160,
          accuracy: 10,
          heading: null,
          speed: 0.1,
          createdAt: new Date(baseTime).toISOString(),
          deviceType: "mobile",
        },
        {
          userId: "user-1",
          latitude: -6.2001,
          longitude: 106.8161,
          accuracy: 12,
          heading: null,
          speed: 0.2,
          createdAt: new Date(baseTime + 15 * 60000).toISOString(),
          deviceType: "mobile",
        },
        {
          userId: "user-1",
          latitude: -6.2000,
          longitude: 106.8160,
          accuracy: 8,
          heading: null,
          speed: 0,
          createdAt: new Date(baseTime + 30 * 60000).toISOString(),
          deviceType: "mobile",
        },
        // Moving point (2 km away, driving)
        {
          userId: "user-1",
          latitude: -6.2180,
          longitude: 106.8300,
          accuracy: 15,
          heading: 120,
          speed: 12.5,
          createdAt: new Date(baseTime + 40 * 60000).toISOString(),
          deviceType: "mobile",
        },
        // Stop 2: Office (stayed 60 mins, current)
        {
          userId: "user-1",
          latitude: -6.2300,
          longitude: 106.8400,
          accuracy: 10,
          heading: null,
          speed: 0.1,
          createdAt: new Date(baseTime + 50 * 60000).toISOString(),
          deviceType: "mobile",
        },
        {
          userId: "user-1",
          latitude: -6.2301,
          longitude: 106.8401,
          accuracy: 10,
          heading: null,
          speed: 0,
          createdAt: new Date(baseTime + 110 * 60000).toISOString(),
          deviceType: "mobile",
        },
      ];

      const stops = detectStopPoints(points);
      expect(stops.length).toBe(2);

      // First stop: Cafe
      expect(stops[0].durationMinutes).toBe(30);
      expect(stops[0].isCurrent).toBe(false);
      expect(stops[0].pointCount).toBe(3);

      // Second stop: Office (Current)
      expect(stops[1].durationMinutes).toBe(60);
      expect(stops[1].isCurrent).toBe(true);
      expect(stops[1].pointCount).toBe(2);
    });
  });

  describe("detectStopPoints (accuracy)", () => {
    const baseTime = new Date("2026-11-20T10:00:00Z").getTime();
    const at = (mins: number, lat: number, lng: number, accuracy: number | null, speed: number | null) => ({
      userId: "u1", latitude: lat, longitude: lng, accuracy, heading: null, speed,
      createdAt: new Date(baseTime + mins * 60000).toISOString(), deviceType: "mobile",
    });

    it("ignores low-accuracy fixes when clustering", () => {
      const points = [
        at(0, -6.2, 106.816, 10, 0.2),
        at(5, -6.2001, 106.8161, 500, 0.1), // drift fix, must be dropped
        at(10, -6.2, 106.816, 12, 0),
        at(20, -6.218, 106.83, 10, 12.5),
        at(60, -6.23, 106.84, 10, 0.1),
      ];
      const stops = detectStopPoints(points);
      expect(stops).toHaveLength(2);
      expect(stops[0].pointCount).toBe(2); // drift point excluded
    });

    it("splits a cluster across a long silence once the person has moved", () => {
      const points = [
        at(0, -6.2, 106.816, 10, 0.1),
        at(10, -6.2, 106.816, 10, 0),
        // ~47m away: within the 50m cluster radius, but far enough that a
        // 50-minute silence means they left and came back.
        at(60, -6.2003, 106.8163, 10, 0.1),
        at(70, -6.2003, 106.8163, 10, 0),
      ];
      const stops = detectStopPoints(points);
      expect(stops).toHaveLength(2);
    });

    it("does not create a stop for a brief drive-through", () => {
      const points = [
        at(0, -6.2, 106.816, 10, 8),
        at(1, -6.2003, 106.8163, 10, 9),
        at(30, -6.23, 106.84, 10, 0.1),
        at(40, -6.2301, 106.8401, 10, 0),
      ];
      const stops = detectStopPoints(points);
      expect(stops).toHaveLength(1); // only the office, which is the current stop
      expect(stops[0].pointCount).toBe(2);
    });

    it("merges clusters split by a drift jump", () => {
      const points = [
        at(0, -6.2, 106.816, 10, 0.1),
        at(5, -6.2, 106.816, 10, 0),
        at(6, -6.2006, 106.8166, 10, 0.4), // ~94m jump -> own cluster
        at(10, -6.2, 106.816, 10, 0), // back near the first cluster
      ];
      const stops = detectStopPoints(points);
      expect(stops).toHaveLength(1);
      expect(stops[0].pointCount).toBe(3); // the 1-minute jump cluster is dropped
      expect(stops[0].isCurrent).toBe(true);
    });
  });

  describe("fetchRoadSnappedRoute", () => {
    it("falls back to waypoints on fetch error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network fail"));
      const pts = [{ lat: -6.25, lng: 106.85 }, { lat: -6.26, lng: 106.86 }];
      const res = await fetchRoadSnappedRoute(pts, { timeoutMs: 1000 });
      expect(res).toEqual([[-6.25, 106.85], [-6.26, 106.86]]);
    });

    it("sends intermediate waypoints as via points, not just first-to-last", async () => {
      const fetchMock = vi.fn(async (_url: string) => ({
        ok: true,
        json: async () => ({ data: { distanceMeters: 5000, durationSeconds: 600, geometry: [[-8, 108], [-8.01, 108.01]], source: "osrm" } }),
      }));
      vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
      await fetchRoadSnappedRoute([
        { lat: -8, lng: 108 },
        { lat: -8.01, lng: 108.01 },
        { lat: -8.02, lng: 108.02 },
      ]);
      expect(String(fetchMock.mock.calls[0][0])).toContain("via=");
      expect(String(fetchMock.mock.calls[0][0])).toContain("-8.01");
    });

    it("maps the proxy payload to Leaflet coordinates", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { distanceMeters: 1234, durationSeconds: 60, geometry: [[-6.2, 106.81], [-6.205, 106.815], [-6.21, 106.82]] },
        }),
      } as Response);
      const pts = [{ lat: -6.2, lng: 106.81 }, { lat: -6.21, lng: 106.82 }];
      const res = await fetchRoadSnappedRoute(pts);
      expect(res).toEqual([[-6.2, 106.81], [-6.205, 106.815], [-6.21, 106.82]]);
    });
  });
});
