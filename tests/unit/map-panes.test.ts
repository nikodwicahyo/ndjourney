import { describe, it, expect } from "vitest";
import {
  HISTORY_TRAIL_STYLE,
  HISTORY_USER_COLORS,
  MAP_PANES,
  NAV_PATH,
  WAYPOINT_ARROW_SIZE,
  waypointArrowSvg,
} from "@/lib/map-panes";

describe("map pane stacking", () => {
  it("keeps waypoint arrows above the dashed trail at every screen position", () => {
    expect(MAP_PANES.route).toBeLessThan(MAP_PANES.history);
    expect(MAP_PANES.history).toBeLessThan(MAP_PANES.waypoint);
    expect(MAP_PANES.waypoint).toBeLessThan(MAP_PANES.marker);
  });

  it("uses a fixed casing/dash in both route modes with partner-colored cores", () => {
    expect(HISTORY_TRAIL_STYLE.casing).toBe("#0f172a");
    expect(HISTORY_TRAIL_STYLE.dash).toBe("6 8");
    expect(HISTORY_USER_COLORS.self).toBe("#3b82f6");
    expect(HISTORY_USER_COLORS.partner).toBe("#F43F5E");
  });

  it("emits a real path element, not raw path data as SVG text", () => {
    // Regression: NAV_PATH briefly held only the `d` value, so every arrow
    // (waypoints, live heading, "Mulai") rendered as nothing at all.
    expect(NAV_PATH).toMatch(/^<path d="M12 2 /);
    expect(waypointArrowSvg(90, HISTORY_USER_COLORS.self).match(/<path /g)).toHaveLength(2);
    expect(waypointArrowSvg(90, HISTORY_USER_COLORS.self)).toContain('d="M12 2 19 21 12 17 5 21Z"');
  });

  it("draws waypoint arrows larger than the trail with a light halo", () => {
    const svg = waypointArrowSvg(90, HISTORY_USER_COLORS.self);
    expect(WAYPOINT_ARROW_SIZE).toBeGreaterThan(HISTORY_TRAIL_STYLE.casingWeight * 2);
    expect(svg).toContain(`width="${WAYPOINT_ARROW_SIZE}"`);
    expect(svg).toContain('stroke="#fff"');
    expect(svg).toContain(`fill="${HISTORY_USER_COLORS.self}"`);
    expect(svg).toContain(`stroke="${HISTORY_TRAIL_STYLE.casing}"`);
    expect(svg).toContain("rotate(90deg)");
    expect(waypointArrowSvg(Number.NaN, HISTORY_USER_COLORS.partner)).toContain(
      "rotate(0deg)",
    );
  });
});
