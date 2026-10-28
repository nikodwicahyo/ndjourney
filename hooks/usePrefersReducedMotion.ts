"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function supported() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

function subscribe(onChange: () => void) {
  if (!supported()) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * SSR-safe `prefers-reduced-motion` (framer's `useReducedMotion` pulled the
 * whole 43 KB library into the hero for one boolean). Server and hydration
 * both read `false`, then the real value arrives on the first store check.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => (supported() ? window.matchMedia(QUERY).matches : false),
    () => false,
  );
}
