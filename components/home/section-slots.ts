// Reserved height for every below-fold section.
//
// Shared by the placeholder that keeps the page scrollable before the chunk
// arrives and by the real sections themselves, so swapping one for the other
// never changes the document height (no scrollbar-thumb jump mid-scroll).
// Values are floors, not exact sizes: `contain-intrinsic-size: auto` replaces
// each with the measured height the first time the section renders.
//
// Floors are small-screen first: `minHeight` is the base (mobile) floor and
// `minHeightMd` optionally overrides it from the `md` breakpoint up. Sections
// whose content grows on desktop declare both — the gallery slideshow card is
// ~320px tall on a phone but ~600px from `md` up, so a single desktop-only floor
// left a dead gap between the slideshow card and the Love Meter card on mobile.
export type SectionSlot = {
  key: string;
  minHeight: number;
  minHeightMd?: number;
};

export const SECTION_SLOTS: readonly SectionSlot[] = [
  { key: "location", minHeight: 220 },
  { key: "countdown", minHeight: 260 },
  { key: "birthday1", minHeight: 200 },
  { key: "birthday2", minHeight: 200 },
  { key: "quote", minHeight: 160 },
  { key: "gallery", minHeight: 320, minHeightMd: 520 },
  { key: "love-meter", minHeight: 420 },
  { key: "bottle-letter", minHeight: 420 },
  { key: "memory-match", minHeight: 380 },
  { key: "daily-task", minHeight: 320 },
];

// Reserved height for one below-fold section at the current viewport.
export function getSectionMinHeight(key: string, atLeastMd = false): number {
  const slot = SECTION_SLOTS.find((s) => s.key === key);
  if (!slot) return 320;
  return atLeastMd && slot.minHeightMd !== undefined
    ? slot.minHeightMd
    : slot.minHeight;
}
