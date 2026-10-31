"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import HeroSection from "./HeroSection";
import ClickHearts from "./ClickHearts";
import { SECTION_SLOTS } from "./section-slots";
import type { GalleryPhoto } from "./GallerySlideshow";
import type { HomeSummaries } from "./HomeStats";
import type { LoveMeterState } from "@/lib/love-meter";
import type { CropRect } from "@/lib/image-crop";

// Below-the-fold content is a separate chunk, fetched only when the visitor
// actually scrolls toward it. It also keeps framer-motion out of the hero's
// critical path.
const HomeBelowFold = dynamic(() => import("./HomeBelowFold"), { ssr: false });

type HomeContentProps = {
  coupleConfig: {
    name1: string;
    name2: string;
    tagline?: string | null;
    heroPhotoUrl?: string | null;
    heroCrop?: CropRect | null;
    anniversaryDate: string;
    birthDate1?: string | null;
    birthDate2?: string | null;
  } | null;
  galleryPhotos: GalleryPhoto[];
  photoCount?: number;
  summaries: HomeSummaries;
  loveMeterTargets: LoveMeterState;
};

// The hero fills ~90svh, so the sentinel only intersects once the visitor has
// scrolled. `rootMargin: 0` (not a negative one) means the below-fold shells
// exist before their first pixel is visible.
function useRevealOnScroll() {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { sentinelRef, revealed };
}

// Warm the below-fold chunk while the page is idle. Without this the first
// scroll gesture paid for a chunk download *and* parse on top of the mount;
// with it the gesture only mounts the one section entering the viewport.
function useWarmBelowFoldChunk() {
  useEffect(() => {
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const warm = () => {
      void import("./HomeBelowFold");
    };

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(warm, { timeout: 4000 });
    } else {
      timeoutId = setTimeout(warm, 2500);
    }

    return () => {
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, []);
}

export default function HomeContent({
  coupleConfig,
  galleryPhotos,
  photoCount = 0,
  summaries,
  loveMeterTargets,
}: HomeContentProps) {
  const { sentinelRef, revealed } = useRevealOnScroll();
  useWarmBelowFoldChunk();

  return (
    <>
      <ClickHearts />

      <HeroSection
        name1={coupleConfig?.name1}
        name2={coupleConfig?.name2}
        tagline={coupleConfig?.tagline}
        heroPhotoUrl={coupleConfig?.heroPhotoUrl}
        heroCrop={coupleConfig?.heroCrop}
      />

      <div id="home-content" ref={sentinelRef} className="scroll-mt-20">
        {revealed ? (
          <HomeBelowFold
            coupleConfig={coupleConfig}
            galleryPhotos={galleryPhotos}
            photoCount={photoCount}
            summaries={summaries}
            loveMeterTargets={loveMeterTargets}
          />
        ) : (
          // Same slot heights the real sections reserve, so the document does
          // not change height when the content swaps in.
          <div aria-hidden="true" className="space-y-16 md:space-y-24">
            {SECTION_SLOTS.map((slot) => (
              <div key={slot.key} style={{ minHeight: slot.minHeight }} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
