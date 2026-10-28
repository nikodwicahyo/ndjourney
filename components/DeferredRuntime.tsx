"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// Service-worker registration and version polling don't affect the first paint,
// and workbox-window was ~11 KB of the critical bundle. Load them once the page
// is loaded and idle so they never compete with hydration.
const PwaRegister = dynamic(() => import("./PwaRegister"), { ssr: false });
const VersionCheck = dynamic(() => import("./VersionCheck"), { ssr: false });

export default function DeferredRuntime() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const enable = () => setReady(true);
    const schedule = () => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(enable, { timeout: 5000 });
      } else {
        timeoutId = setTimeout(enable, 2500);
      }
    };

    if (document.readyState === "complete") {
      schedule();
    } else {
      window.addEventListener("load", schedule, { once: true });
    }

    return () => {
      window.removeEventListener("load", schedule);
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, []);

  if (!ready) return null;

  return (
    <>
      <VersionCheck />
      <PwaRegister />
    </>
  );
}
