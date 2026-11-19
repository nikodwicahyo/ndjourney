"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void, query: string) {
  const mql = window.matchMedia(query);
  mql.addEventListener?.("change", onChange);
  return () => mql.removeEventListener?.("change", onChange);
}

/**
 * SSR-safe viewport media query boolean (e.g. `(min-width: 768px)`).
 * The server snapshot reads as small-screen so server-rendered output never
 * over-reserves; the client re-checks after hydration and re-renders if the
 * real viewport differs.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => subscribe(onChange, query),
    () => window.matchMedia(query).matches,
    () => false,
  );
}
