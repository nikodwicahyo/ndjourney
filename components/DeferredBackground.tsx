"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// three.js + the WebGL scene are heavy and purely decorative. Keep them out of
// the first-load bundle and mount only once the browser is idle after paint,
// so they never compete with hydration or LCP.
const BackgroundEffect = dynamic(() => import("./BackgroundEffect"), {
  ssr: false,
});

export default function DeferredBackground() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const enable = () => setEnabled(true);
    const schedule = () => {
      if (typeof window.requestIdleCallback === "function") {
        // Long timeout is only a safety net: on slow devices the callback must
        // wait for hydration to finish instead of interrupting it.
        idleId = window.requestIdleCallback(enable, { timeout: 5000 });
      } else {
        // Safari fallback: rIC is still missing there. Wait past hydration.
        timeoutId = setTimeout(enable, 2500);
      }
    };

    // Wait for the load event: on a throttled phone the LCP image is still
    // downloading, and pulling ~150 KB of three.js before it would starve it.
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

  return enabled ? <BackgroundEffect /> : null;
}
