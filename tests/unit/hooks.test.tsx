// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCountdown } from "@/hooks/useCountdown";
import { useClockTick } from "@/hooks/useClockTick";

afterEach(() => {
  vi.useRealTimers();
});

describe("useClockTick", () => {
  it("returns shared now and ticks every second", () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useClockTick());
    expect(result.current.now).toBeInstanceOf(Date);
    expect(result.current.tick).toBe(0);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current.tick).toBe(3);
    unmount();
  });
});

describe("useCountdown (F-01 hero countdown)", () => {
  it("counts days since past anniversary", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000 - 3600000);
    const { result, unmount } = renderHook(() => useCountdown(threeDaysAgo));
    expect(result.current.isPast).toBe(true);
    expect(result.current.days).toBeGreaterThanOrEqual(2);
    expect(result.current.totalDays).toBe(result.current.days);
    unmount();
  });

  it("future date is not past and totalDays is 0", () => {
    const future = new Date(Date.now() + 5 * 86400000);
    const { result, unmount } = renderHook(() => useCountdown(future));
    expect(result.current.isPast).toBe(false);
    expect(result.current.totalDays).toBe(0);
    expect(result.current.days).toBeGreaterThanOrEqual(4);
    unmount();
  });

  it("null target yields zeros", () => {
    const { result, unmount } = renderHook(() => useCountdown(null));
    expect(result.current).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: false, totalDays: 0 });
    unmount();
  });
});
