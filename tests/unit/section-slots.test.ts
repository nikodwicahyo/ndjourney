import { describe, it, expect } from "vitest";
import { SECTION_SLOTS, getSectionMinHeight } from "@/components/home/section-slots";

describe("section slot heights", () => {
  it("reserves the gallery section less on small screens than on desktop", () => {
    // Regression: a single desktop-only gallery floor (520px) left a dead gap
    // between the slideshow card (~320px) and the Love Meter card on mobile.
    expect(getSectionMinHeight("gallery", false)).toBeLessThan(getSectionMinHeight("gallery", true));
    expect(getSectionMinHeight("gallery", true)).toBe(520);
    expect(getSectionMinHeight("gallery", false)).toBeLessThanOrEqual(320);
  });

  it("reuses each base floor on all widths when no desktop override is set", () => {
    expect(getSectionMinHeight("love-meter", false)).toBe(getSectionMinHeight("love-meter", true));
  });

  it("falls back to the default floor for an unknown slot", () => {
    expect(getSectionMinHeight("nope", false)).toBe(320);
    expect(getSectionMinHeight("nope", true)).toBe(320);
  });

  it("keeps every below-fold slot reachable by its key", () => {
    // The real sections and the placeholder map stay in sync through the same helper.
    for (const slot of SECTION_SLOTS) {
      expect(getSectionMinHeight(slot.key, false)).toBeGreaterThan(0);
      expect(getSectionMinHeight(slot.key, true)).toBeGreaterThan(0);
    }
  });
});
