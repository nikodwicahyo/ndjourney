import { describe, it, expect } from "vitest";
import { HISTORY_TRAIL_STYLE, HISTORY_USER_COLORS, MAP_PANES } from "@/lib/map-panes";

describe("map pane stacking", () => {
  it("keeps the dashed history trail above the live route but below pins", () => {
    expect(MAP_PANES.history).toBeGreaterThan(MAP_PANES.route);
    expect(MAP_PANES.marker).toBeGreaterThan(MAP_PANES.history);
  });

  it("uses a fixed casing/dash in both route modes with partner-colored cores", () => {
    expect(HISTORY_TRAIL_STYLE.casing).toBe("#0f172a");
    expect(HISTORY_TRAIL_STYLE.dash).toBe("6 8");
    expect(HISTORY_USER_COLORS.self).toBe("#3b82f6");
    expect(HISTORY_USER_COLORS.partner).toBe("#F43F5E");
  });
});
