/**
 * Leaflet stacking contract for the location map. Kept as data so the
 * history/route overlap cannot silently regress.
 *   accuracy < live route < dashed history < waypoint arrows < avatars/stop pins
 * Waypoints get their own pane: Leaflet gives marker icons a z-index of
 * screenY + offset, while its SVG renderer uses 200, so sharing the history
 * pane made arrows near the top edge fall behind the dashed line.
 */
export const MAP_PANES = {
  accuracy: 400,
  route: 420,
  history: 430,
  waypoint: 440,
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

/**
 * Who owns the map camera.
 * - "auto": frame both pins/trail, keep them on screen as fixes arrive.
 * - "self": "Pusatkan ke saya" — follow my pin only, never refit to both.
 * - "user": a gesture or a picked stop — nothing but a history filter change
 *   may move the map.
 */
export type CameraOwner = "auto" | "self" | "user";

export type CameraAction = "fit-pins" | "follow-pin" | "default" | "none";

const NAV_D = "M12 2 19 21 12 17 5 21Z";

/** Full SVG path element, pointing north (up) so rotate(bearing) is accurate.
 *  Consumers inline it into an <svg>, so it must NOT be reduced to just `d`. */
export const NAV_PATH = `<path d="${NAV_D}"/>`;

/**
 * Icon box must be wider than the arrow itself: the path spans 14 of the 24
 * viewBox units, so a 28px box renders a ~16px arrow — twice the 8px trail
 * casing instead of disappearing into it.
 */
export const WAYPOINT_ARROW_SIZE = 28;

/**
 * Waypoint arrow: user color core, dark casing matching the history line, and
 * a white halo so the arrow reads over the dashed trail and on any tile.
 * Kept here so the map and its tests share one visual contract.
 */
export function waypointArrowSvg(
  heading: number,
  color: string,
  size = WAYPOINT_ARROW_SIZE,
): string {
  const deg = Number.isFinite(heading) ? heading : 0;
  return `<div style="width:${size}px;height:${size}px;transform:rotate(${deg}deg);filter:drop-shadow(0 1px 2px rgba(0,0,0,.45));"><svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" style="display:block;overflow:visible;"><path d="${NAV_D}" fill="#fff" stroke="#fff" stroke-width="7" stroke-linejoin="round"/><path d="${NAV_D}" fill="${color}" stroke="${HISTORY_TRAIL_STYLE.casing}" stroke-width="3.5" stroke-linejoin="round"/></svg></div>`;
}

/**
 * Decide what (if anything) a data update may do to the camera. Pure so the
 * rule that used to snap the map back to both pins can be tested directly.
 * `inView` = the points this owner cares about are inside the padded viewport.
 */
export function nextCameraAction({
  owner,
  pinCount,
  fitted,
  inView,
}: {
  owner: CameraOwner;
  pinCount: number;
  fitted: boolean;
  inView: boolean;
}): CameraAction {
  if (owner === "user") return "none";
  if (owner === "self") return pinCount > 0 && !inView ? "follow-pin" : "none";
  if (pinCount === 0) return fitted ? "none" : "default";
  if (!fitted) return "fit-pins";
  if (inView) return "none";
  return pinCount === 2 ? "fit-pins" : "follow-pin";
}
