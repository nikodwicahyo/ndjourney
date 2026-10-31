"use client";

import { MotionConfig } from "framer-motion";

// Single reduced-motion gate for the whole app: with "user", framer-motion
// itself disables transform/layout animations for users with the OS setting and
// keeps opacity transitions, so the UI still feels alive instead of snapping.
// per-component `initial`/`variants` must therefore stay STATIC (identical
// SSR and first client paint) — never branch them on useReducedMotion(),
// or hydration mismatches. The hook is intentionally gone; all motion policy
// lives here (framer) and in the global CSS reduced-motion block.
export default function MotionRoot({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
