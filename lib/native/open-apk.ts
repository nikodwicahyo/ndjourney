/**
 * Navigate to an external APK URL. Capacitor's WebViewClient converts the
 * external navigation into an OS install intent; the legacy
 * `window.open(url, "_system")` call is a no-op on Capacitor v8.
 *
 * Kept as a one-line seam so the behaviour is testable — jsdom's
 * `window.location.assign` is non-configurable and cannot be spied on.
 */
export function openExternalUrl(url: string): void {
  window.location.assign(url);
}
