"use client";

import { useSyncExternalStore } from "react";

function noopSubscribe(): () => void {
  return () => {};
}

/**
 * True only after client mount (false during SSR/prerender).
 * Use to gate client-only content (localStorage/random/window-dependent)
 * so server HTML and first client render match.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
