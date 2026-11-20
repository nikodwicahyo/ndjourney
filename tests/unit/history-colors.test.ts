import { describe, it, expect } from "vitest";
import {
  HISTORY_SELF_COLOR,
  HISTORY_PARTNER_COLOR,
  ROAD_ROUTE_COLOR,
  STRAIGHT_ROUTE_COLOR,
} from "@/lib/routing";

describe("history colours", () => {
  it("uses two distinct green shades for history, never the road blue", () => {
    expect(HISTORY_SELF_COLOR).toBe("#16a34a");
    expect(HISTORY_PARTNER_COLOR).toBe("#0d9488");
    expect(HISTORY_SELF_COLOR).not.toBe(HISTORY_PARTNER_COLOR);
    expect(HISTORY_SELF_COLOR).not.toBe(ROAD_ROUTE_COLOR);
    expect(HISTORY_PARTNER_COLOR).not.toBe(ROAD_ROUTE_COLOR);
    expect(HISTORY_SELF_COLOR).not.toBe(STRAIGHT_ROUTE_COLOR);
    expect(HISTORY_PARTNER_COLOR).not.toBe(STRAIGHT_ROUTE_COLOR);
  });
});
