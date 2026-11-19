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

  it("keeps naming when the stops array identity changes on every render", async () => {
    vi.useFakeTimers();
    const { reverseGeocodeName } = await import("@/lib/routing");
    vi.mocked(reverseGeocodeName).mockClear();
    const { result } = renderHook(() => usePlaceNames([stop("u1"), stop("u2")]));
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(reverseGeocodeName).toHaveBeenCalledTimes(2);
    expect(result.current.u1).toBe("Kafe");
    expect(result.current.u2).toBe("Kafe");
  });

  it("does not abandon a stop when a render interrupts an in-flight geocode", async () => {
    vi.useFakeTimers();
    const { reverseGeocodeName } = await import("@/lib/routing");
    let finishFirst: (name: string) => void = () => {};
    vi.mocked(reverseGeocodeName)
      .mockImplementationOnce(() => new Promise<string>((resolve) => { finishFirst = resolve; }))
      .mockResolvedValueOnce("Kafe")
      .mockResolvedValueOnce("Kafe");

    // New array identity on every render, like LocationManager before memoization.
    const { result, rerender } = renderHook(() => usePlaceNames([stop("p1"), stop("p2")]));
    await act(async () => {});
    rerender(); // a 15s presence poll re-renders while p1's request is pending
    await act(async () => { finishFirst("Kafe"); await vi.advanceTimersByTimeAsync(1500); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });

    expect(result.current.p1).toBe("Kafe");
    expect(result.current.p2).toBe("Kafe");
  });
});
