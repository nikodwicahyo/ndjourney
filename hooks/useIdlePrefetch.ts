"use client";

import { useEffect, useState } from "react";

// Next prefetches every link that enters the viewport. On first load that made
// the nav pull six route bundles + RSC payloads while the LCP image was still
// arriving. Enable prefetching only after the page is idle, so navigation is
// still instant but nothing competes with the initial paint.
export function useIdlePrefetch(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let floorId: ReturnType<typeof setTimeout> | undefined;

    // Two-stage: never before 2.5 s (a warm idle fires almost immediately and
    // would pull the route bundles into the LCP window), then on the next idle.
    floorId = setTimeout(() => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(() => setEnabled(true), {
          timeout: 4000,
        });
      } else {
        setEnabled(true);
      }
    }, 2500);

    return () => {
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      if (floorId !== undefined) clearTimeout(floorId);
    };
  }, []);

  return enabled;
}
