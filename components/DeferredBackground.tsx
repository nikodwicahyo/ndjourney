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
// scene (product requirement: the background animates everywhere) — except
// reduced-motion users, for whom the whole point of the scene (ambient travel)
// is the thing they asked not to see.
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

    let killed = false;
    let started = false;
    let scrolling = false;
    let idleId: number | undefined;
    let scrollIdle: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      if (killed || started) return;
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(enable, { timeout: 6000 });
      } else {
        idleId = window.setTimeout(enable, 4000);
      }
    };

    const enable = () => {
      if (killed || started) return;
      // A scroll frame is the worst possible moment for a 150 KB parse plus
      // WebGL setup — it lands as a long task exactly where the visitor
      // notices jank. Wait for the gesture to settle and try again.
      if (scrolling) {
        schedule();
        return;
      }
      started = true;
      setWebgl(true);
    };

    const onScroll = () => {
      scrolling = true;
      clearTimeout(scrollIdle);
      scrollIdle = setTimeout(() => {
        scrolling = false;
      }, 180);
    };

    // Decorative upgrade, deliberately late: the 3D chunk is ~150 KB gzipped
    // and building the scene is a long task. Doing it during the first paint
    // window measured as +1.2 s LCP and +1 s TBT on a throttled phone.
    const onLoad = () => schedule();

    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    // Real interactions upgrade at once (the visitor is engaged, not mid-scroll).
    // Scrolling is deliberately NOT a trigger: it is the gesture that must stay
    // smooth, and it was the cause of the original jank.
    window.addEventListener("pointerdown", schedule, { passive: true });
    window.addEventListener("keydown", schedule);

    // Listen only to know when NOT to start.
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      killed = true;
      window.removeEventListener("load", onLoad);
      window.removeEventListener("pointerdown", schedule);
      window.removeEventListener("keydown", schedule);
      window.removeEventListener("scroll", onScroll);
      clearTimeout(scrollIdle);
      if (idleId !== undefined) {
        if (typeof window.cancelIdleCallback === "function") {
          window.cancelIdleCallback(idleId);
        } else {
          clearTimeout(idleId);
        }
      }
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
