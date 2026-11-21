/**
 * Leaflet stacking contract for the location map. Kept as data so the
 * history/route overlap cannot silently regress.
 *   accuracy < live route < dashed history < avatars/stop pins
 */
export const MAP_PANES = {
  accuracy: 400,
  route: 420,
  history: 430,
  marker: 600,
} as const;

/** Fixed casing/dash in both route modes; the core dash uses partner colors. */
export const HISTORY_TRAIL_STYLE = {
  casing: "#0f172a",
  dash: "6 8",
  casingWeight: 8,
  coreWeight: 4,
} as const;

/** Partner A (self) and partner B colors, shared by map trail and legend. */
export const HISTORY_USER_COLORS = {
  self: "#3b82f6",
  partner: "#F43F5E",
} as const;
