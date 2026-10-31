// Reserved height for every below-fold section.
//
// Shared by the placeholder that keeps the page scrollable before the chunk
// arrives and by the real sections themselves, so swapping one for the other
// never changes the document height (no scrollbar-thumb jump mid-scroll).
// Values are floors, not exact sizes: `contain-intrinsic-size: auto` replaces
// each with the measured height the first time the section renders.
export const SECTION_SLOTS = [
  { key: "location", minHeight: 220 },
  { key: "countdown", minHeight: 260 },
  { key: "birthday1", minHeight: 200 },
  { key: "birthday2", minHeight: 200 },
  { key: "quote", minHeight: 160 },
  { key: "gallery", minHeight: 520 },
  { key: "love-meter", minHeight: 420 },
  { key: "bottle-letter", minHeight: 420 },
  { key: "memory-match", minHeight: 380 },
  { key: "daily-task", minHeight: 320 },
] as const;
