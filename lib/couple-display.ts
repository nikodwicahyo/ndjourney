/** Single source of truth for brand + couple-display fallbacks.
 *  DB (`CoupleConfig`) wins wherever it is available; these are only used
 *  when the config row is missing / fields are empty / static files can't
 *  query the DB (manifest, offline page, static metadata).
 */

export const APP_NAME = "NDjourney";

export const DEFAULT_TAGLINE = "Tempat semua cerita kita tersimpan selamanya.";

export const DEFAULT_NAME1 = "Kamu";
export const DEFAULT_NAME2 = "Pasangan";

/** "Name1 & Name2" with empty-safe fallbacks. */
export function formatCoupleNames(
  name1?: string | null,
  name2?: string | null,
): string {
  const n1 = name1?.trim() || DEFAULT_NAME1;
  const n2 = name2?.trim() || DEFAULT_NAME2;
  return `${n1} & ${n2}`;
}

/** First-word nickname: "Niko Dwicahyo" -> "Niko". Empty-safe. */
export function nickname(
  name?: string | null,
  fallback?: string,
): string {
  const first = name?.trim().split(/\s+/)[0];
  if (first) return first;
  return fallback ?? "";
}

/** Tagline with empty-safe fallback. */
export function resolveTagline(tagline?: string | null): string {
  const t = tagline?.trim();
  return t ? t : DEFAULT_TAGLINE;
}
