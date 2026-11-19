// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/lib/routing", () => ({
  fetchRoadRoute: vi.fn(),
  reverseGeocodeName: vi.fn(async () => "Kafe"),
}));

import { usePlaceNames } from "@/hooks/useLocation";
import type { VisitedStop } from "@/lib/location-history";

const stop = (id: string): VisitedStop => ({
  id, userId: "u1", latitude: -6.2, longitude: 106.81,
  arrivedAt: "2026-11-20T10:00:00Z", departedAt: "2026-11-20T10:30:00Z",
  durationMinutes: 30, pointCount: 3, isCurrent: false,
});

afterEach(() => vi.useRealTimers());

describe("usePlaceNames", () => {
  it("geocodes each stop once, sequentially", async () => {
    vi.useFakeTimers();
    const stops = [stop("s1"), stop("s2")]; // stable identity across renders
    const { reverseGeocodeName } = await import("@/lib/routing");
    vi.mocked(reverseGeocodeName).mockClear();
    const { result } = renderHook(() => usePlaceNames(stops));
    await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
    expect(reverseGeocodeName).toHaveBeenCalledTimes(2);
    expect(result.current.s1).toBe("Kafe");
    expect(result.current.s2).toBe("Kafe");
  });
});
