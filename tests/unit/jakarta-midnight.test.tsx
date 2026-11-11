// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  getJakartaDayKey,
  msUntilNextJakartaMidnight,
} from "@/lib/date";
import { formatDateTime } from "@/lib/utils";
import { useJakartaToday } from "@/hooks/useJakartaToday";

// 2026-11-11T16:59:00Z = 23:59 Asia/Jakarta; one minute later is a new day.
const ONE_MIN_TO_MIDNIGHT = new Date("2026-11-11T16:59:00Z");

afterEach(() => {
  vi.useRealTimers();
});

describe("Jakarta midnight helpers", () => {
  it("msUntilNextJakartaMidnight lands exactly on 00:00 WIB", () => {
    expect(msUntilNextJakartaMidnight(ONE_MIN_TO_MIDNIGHT)).toBe(60_000);
    expect(msUntilNextJakartaMidnight(new Date("2026-11-11T17:00:00Z"))).toBe(
      24 * 60 * 60 * 1000,
    );
  });

  it("getJakartaDayKey shifts whole Jakarta days, not local ones", () => {
    const lateNight = new Date("2026-11-11T16:59:00Z"); // 23:59 WIB Nov 11
    expect(getJakartaDayKey(0, lateNight)).toBe("2026-11-11");
    expect(getJakartaDayKey(-1, lateNight)).toBe("2026-11-10");
    expect(
      getJakartaDayKey(0, new Date("2026-11-11T17:00:01Z")), // 00:00:01 WIB Nov 12
    ).toBe("2026-11-12");
  });

  it("formatDateTime renders the Jakarta clock, not the local one", () => {
    expect(formatDateTime("2026-11-11T17:31:00Z")).toBe("00:31, 12 Nov 2026");
  });
});

describe("useJakartaToday", () => {
  it("flips the day at Jakarta midnight while mounted", () => {
    vi.useFakeTimers();
    vi.setSystemTime(ONE_MIN_TO_MIDNIGHT);

    const { result } = renderHook(() => useJakartaToday());
    expect(result.current).toBe("2026-11-11");

    act(() => {
      vi.advanceTimersByTime(61_000);
    });

    expect(result.current).toBe("2026-11-12");
  });
});
