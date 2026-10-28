"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// three.js + the WebGL scene are heavy (~147 KB gzipped) and purely decorative,
// so they are split out of the first load and mounted after the page is idle.
// The CSS heart field underneath animates from the very first frame, so the
// background is never empty while the scene downloads.
const BackgroundEffect = dynamic(() => import("./BackgroundEffect"), {
  ssr: false,
});

// Data-saver users get the CSS field only: the fanciest background is not worth
// a metered download. Every other device — phone or desktop — renders the 3D
// scene (product requirement: the background animates everywhere).
function shouldUseWebGL(): boolean {
  if (typeof window === "undefined") return false;
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection;
  return !connection?.saveData;
}

// Static positions: identical on server and client (no hydration mismatch).
const HEARTS = [
  { left: "6%", size: 22, duration: 26, delay: -3 },
  { left: "22%", size: 14, duration: 34, delay: -18 },
  { left: "38%", size: 18, duration: 29, delay: -9 },
  { left: "54%", size: 12, duration: 38, delay: -25 },
  { left: "68%", size: 20, duration: 31, delay: -14 },
  { left: "82%", size: 16, duration: 27, delay: -6 },
  { left: "93%", size: 11, duration: 36, delay: -21 },
] as const;

function CssHeartField() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {HEARTS.map((heart) => (
        <span
          key={heart.left}
          className="css-heart"
          style={{
            left: heart.left,
            fontSize: `${heart.size}px`,
            animationDuration: `${heart.duration}s`,
            animationDelay: `${heart.delay}s`,
          }}
        >
          ♥
        </span>
      ))}
    </div>
  );
}

export default function DeferredBackground() {
  const [webgl, setWebgl] = useState(false);
  // The CSS field keeps animating behind the canvas until the scene is really
  // on screen, then cross-fades out — no blank frame, no double hearts.
  const [webglReady, setWebglReady] = useState(false);
  const [cssRetired, setCssRetired] = useState(false);

  useEffect(() => {
    if (!shouldUseWebGL()) return;

    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let killed = false;

    const enable = () => {
      if (killed) return;
      cleanup();
      setWebgl(true);
    };
    const cleanup = () => {
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      window.removeEventListener("load", onLoad);
      window.removeEventListener("scroll", enable);
      window.removeEventListener("pointerdown", enable);
      window.removeEventListener("touchstart", enable);
      window.removeEventListener("keydown", enable);
    };

    const onLoad = () => {
      // Decorative upgrade, deliberately late: the 3D chunk is ~150 KB gzipped
      // and building the scene is a long task. Doing it during the first paint
      // window measured as +1.2 s LCP and +1 s TBT on a throttled phone.
      timeoutId = setTimeout(enable, 6000);
    };

    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    // …but the visitor never waits for a timer: interacting upgrades at once.
    window.addEventListener("scroll", enable, { passive: true });
    window.addEventListener("pointerdown", enable, { passive: true });
    window.addEventListener("touchstart", enable, { passive: true });
    window.addEventListener("keydown", enable);

    return () => {
      killed = true;
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (!webgl) return;
    // One frame after the scene mounts: hand over from CSS hearts to WebGL.
    const id = requestAnimationFrame(() => setWebglReady(true));
    return () => cancelAnimationFrame(id);
  }, [webgl]);

  // Retire the CSS field once the cross-fade is over: 7 permanently animating
  // nodes behind an opaque canvas are pure compositor work for no pixels.
  useEffect(() => {
    if (!webglReady) return;
    const id = setTimeout(() => setCssRetired(true), 800);
    return () => clearTimeout(id);
  }, [webglReady]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: -10 }}
    >
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{ opacity: webglReady ? 0 : 1 }}
      >
        {!cssRetired && <CssHeartField />}
      </div>
      {webgl && <BackgroundEffect />}
      {/* Rose vignette: rich edges, calm center for text */}
      <div className="absolute inset-0" style={{ background: "var(--bg-vignette)" }} />
      {/* Readability veil: keeps cards/text contrast in both modes */}
      <div className="absolute inset-0 bg-rose-50/35 dark:bg-black/50" />
    </div>
  );
}
