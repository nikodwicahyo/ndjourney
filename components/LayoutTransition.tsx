"use client";

import { usePathname } from "next/navigation";

// Route entrance lives in CSS, never in JS. A framer `initial={{opacity:0}}`
// wrapper is server-rendered as opacity:0, so the whole page stays invisible
// until hydration finishes (Lighthouse measured a 2s LCP element render delay).
// A transform-only CSS animation starts on the first painted frame instead.
export default function LayoutTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
