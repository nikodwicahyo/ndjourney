export type DeviceType = "mobile" | "tablet" | "desktop";

export function detectDeviceType(): DeviceType {
  if (typeof navigator === "undefined") return "desktop";

  const ua = navigator.userAgent;
  const tablets = /iPad|Tablet|PlayBook|Silk|Kindle|Galaxy Tab|Nexus (7|9|10)/i.test(ua);
  const mobiles =
    /Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Windows Phone/i.test(ua);

  if (tablets) return "tablet";

  // iPadOS reports as Macintosh but exposes touch points.
  const touchPoints = navigator.maxTouchPoints ?? 0;
  if (mobiles || (touchPoints > 1 && /Macintosh/.test(ua))) return "mobile";

  return "desktop";
}
