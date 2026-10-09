import { describe, it, expect } from "vitest";
import {
  APP_NAME,
  DEFAULT_TAGLINE,
  DEFAULT_NAME1,
  DEFAULT_NAME2,
  formatCoupleNames,
  nickname,
  resolveTagline,
} from "@/lib/couple-display";

describe("couple-display fallbacks", () => {
  it("brand stays constant", () => {
    expect(APP_NAME).toBe("NDjourney");
    expect(DEFAULT_TAGLINE.length).toBeGreaterThan(0);
  });

  it("formatCoupleNames falls back per empty name", () => {
    expect(formatCoupleNames("Niko", "Dzikria")).toBe("Niko & Dzikria");
    expect(formatCoupleNames("", "")).toBe(`${DEFAULT_NAME1} & ${DEFAULT_NAME2}`);
    expect(formatCoupleNames(null, undefined)).toBe(`${DEFAULT_NAME1} & ${DEFAULT_NAME2}`);
    expect(formatCoupleNames("  ", "Dzikria")).toBe(`${DEFAULT_NAME1} & Dzikria`);
  });

  it("nickname takes the first word", () => {
    expect(nickname("Niko Dwicahyo Widiyanto", DEFAULT_NAME1)).toBe("Niko");
    expect(nickname("  Dzikria   Putri  ", DEFAULT_NAME2)).toBe("Dzikria");
    expect(nickname("", DEFAULT_NAME1)).toBe(DEFAULT_NAME1);
    expect(nickname(null, DEFAULT_NAME2)).toBe(DEFAULT_NAME2);
  });

  it("resolveTagline falls back on empty/null", () => {
    expect(resolveTagline("Dua hati, satu cerita")).toBe("Dua hati, satu cerita");
    expect(resolveTagline(null)).toBe(DEFAULT_TAGLINE);
    expect(resolveTagline("   ")).toBe(DEFAULT_TAGLINE);
    expect(resolveTagline(undefined)).toBe(DEFAULT_TAGLINE);
  });
});
