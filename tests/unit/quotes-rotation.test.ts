import { describe, expect, it } from "vitest";
import {
  QUOTES,
  getQuoteIndex,
  getQuoteOfTheDay,
  msUntilNextQuotePeriod,
  quotePeriodOrdinal,
} from "@/lib/quotes";
import { getJakartaParts } from "@/lib/date";

const HOUR = 60 * 60 * 1000;
const PERIOD_HOURS = 6;
// 2026-11-14T00:00:00+07:00 — a 6-hour WIB boundary.
const BASE = Date.UTC(2026, 10, 13, 17, 0, 0, 0);

describe("quote rotation (6 jam WIB)", () => {
  it("holds one quote per period and advances on every WIB boundary", () => {
    for (let period = 0; period < 4; period++) {
      const start = BASE + period * PERIOD_HOURS * HOUR;
      const inside = quotePeriodOrdinal(new Date(start + PERIOD_HOURS * HOUR - 1));

      expect(quotePeriodOrdinal(new Date(start))).toBe(quotePeriodOrdinal(new Date(start + HOUR)));
      expect(inside).toBe(quotePeriodOrdinal(new Date(start)));
      expect(quotePeriodOrdinal(new Date(start + PERIOD_HOURS * HOUR))).toBe(
        quotePeriodOrdinal(new Date(start)) + 1,
      );
      expect(getQuoteOfTheDay([], new Date(start))).toBe(
        getQuoteOfTheDay([], new Date(start + (PERIOD_HOURS - 1) * HOUR)),
      );
    }
  });

  it("changes the quote every period and never repeats back-to-back", () => {
    const seen = new Set<string>();
    let previous: string | null = null;

    for (let i = 0; i < QUOTES.length * 3; i++) {
      const quote = getQuoteOfTheDay([], new Date(BASE + i * PERIOD_HOURS * HOUR));
      expect(quote).not.toBe(previous);
      seen.add(quote);
      previous = quote;
    }
    expect(seen.size).toBe(QUOTES.length);
  });

  it("covers every quote exactly once per cycle", () => {
    const count = QUOTES.length;
    expect(new Set(QUOTES).size).toBe(count); // no duplicate lines
    const ordinal = quotePeriodOrdinal(new Date(BASE));
    const cycleStart = Math.floor(ordinal / count) * count;

    const indices = Array.from({ length: count }, (_, i) => getQuoteIndex(cycleStart + i));
    expect(new Set(indices).size).toBe(count);
  });

  it("stays deterministic for the same instant", () => {
    const now = new Date(BASE + 7 * HOUR);
    expect(getQuoteOfTheDay([], now)).toBe(getQuoteOfTheDay([], now));
    expect(quotePeriodOrdinal(now)).toBe(quotePeriodOrdinal(new Date(now.getTime())));
  });

  it("schedules the next boundary inside the 6h window, on a WIB multiple of 6", () => {
    for (let h = 0; h < 24; h++) {
      const now = new Date(BASE + h * HOUR + 17 * 60 * 1000);
      const ms = msUntilNextQuotePeriod(now);

      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThanOrEqual(PERIOD_HOURS * HOUR);

      const boundary = getJakartaParts(new Date(now.getTime() + ms));
      expect(boundary).not.toBeNull();
      expect(boundary!.hour % PERIOD_HOURS).toBe(0);
      expect(boundary!.minute).toBe(0);
    }

    // Exactly on a boundary waits a full period; one second before waits 1s.
    expect(msUntilNextQuotePeriod(new Date(BASE))).toBe(PERIOD_HOURS * HOUR);
    expect(msUntilNextQuotePeriod(new Date(BASE + PERIOD_HOURS * HOUR - 1000))).toBe(1000);
  });

  it("still honours the excludeIndices argument", () => {
    const now = new Date(BASE);
    const allButLast = QUOTES.map((_, i) => i).slice(0, -1);
    expect(getQuoteOfTheDay(allButLast, now)).toBe(QUOTES[QUOTES.length - 1]);
  });
});
