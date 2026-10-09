"use client";

import { MotionConfig } from "framer-motion";

// Single reduced-motion gate for the whole app: with "user", framer-motion
// itself disables transform/layout animations for users with the OS setting.
// per-component `initial`/`variants` must therefore stay STATIC (identical
// SSR and first client paint) — never branch them on useReducedMotion(),
// or hydration mismatches. The hook remains for BEHAVIOR only (skip
// autoplay, instant results, no-repeat loops), which never reaches HTML.
export default function MotionRoot({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
