"use client";

import { useEffect, useRef, useState } from "react";

// Every below-fold section mounts on approach instead of all at once. Mounting
// ten widgets in one commit is a single long task; spread across the scroll it
// is invisible. `rootMargin` gives one screen of lead time so a section is
// mounted and settled before it is actually visible.
const LEAD_TIME = "600px 0px";

type RevealProps = {
  minHeight: number;
  children: React.ReactNode;
};

export default function Reveal({ minHeight, children }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  // No IntersectionObserver (old browser / jsdom): show immediately rather
  // than leaving an empty slot forever. Initialized lazily so the effect never
  // has to setState synchronously in its body.
  const [shown, setShown] = useState(
    () => typeof IntersectionObserver === "undefined",
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: LEAD_TIME },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className="reveal-slot"
      style={{ "--reveal-h": `${minHeight}px` } as React.CSSProperties}
    >
      {shown ? children : null}
    </section>
  );
}
