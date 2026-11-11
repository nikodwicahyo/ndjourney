// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  formatCountdownRemaining,
  formatInJakarta,
  formatJakartaTime,
  getJakartaDayKey,
  msUntilNextJakartaMidnight,
  parseJakartaDateTime,
} from "@/lib/date";
import { formatDateTime } from "@/lib/utils";
import { useJakartaToday } from "@/hooks/useJakartaToday";
import { isLetterLocked } from "@/lib/letter-lock";

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

  it("a 12 Nov 2026 00.00 capsule unlocks exactly at Jakarta midnight", () => {
    const unlockAt = parseJakartaDateTime("2026-11-12", "00:00");
    expect(unlockAt?.toISOString()).toBe("2026-11-11T17:00:00.000Z");

    // One millisecond before midnight it is still locked; at midnight it opens.
    expect(
      isLetterLocked(
        { isTimeCapsule: true, unlockAt, isOpened: false },
        Date.parse("2026-11-11T16:59:59.999Z"),
      ),
    ).toBe(true);
    expect(
      isLetterLocked(
        { isTimeCapsule: true, unlockAt, isOpened: false },
        Date.parse("2026-11-11T17:00:00.000Z"),
      ),
    ).toBe(false);

    // The lock screen shows the intended Jakarta date and time.
    expect(
      formatInJakarta(unlockAt!, { day: "numeric", month: "long", year: "numeric" }),
    ).toBe("12 November 2026");
    expect(formatJakartaTime(unlockAt!)).toBe("00:00");
  });

  it("formatJakartaTime always uses HH:mm, never the locale's 00.00", () => {
    expect(formatJakartaTime("2026-11-11T17:00:00Z")).toBe("00:00");
    expect(formatJakartaTime("2026-11-11T16:59:00Z")).toBe("23:59");
    expect(formatJakartaTime("2026-11-11T18:05:00Z")).toBe("01:05");
  });

  it("formatCountdownRemaining reports hours and minutes, not whole days", () => {
    expect(formatCountdownRemaining(4 * 3_600_000 + 12 * 60_000)).toBe(
      "4 jam 12 menit lagi",
    );
    expect(formatCountdownRemaining(26 * 3_600_000 + 5 * 60_000)).toBe(
      "1 hari 2 jam 5 menit lagi",
    );
    expect(formatCountdownRemaining(60_000)).toBe("1 menit lagi");
    expect(formatCountdownRemaining(59_000)).toBe("kurang dari 1 menit lagi");
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
