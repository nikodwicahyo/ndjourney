"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import HeroSection from "./HeroSection";
import ClickHearts from "./ClickHearts";
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

// The hero fills ~90svh, so the sentinel starts just below the fold. Requiring
// it to reach 25% above the bottom of the viewport means "the visitor scrolled"
// — never the first paint.
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
      { rootMargin: "0px 0px -25% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { sentinelRef, revealed };
}

export default function HomeContent({
  coupleConfig,
  galleryPhotos,
  photoCount = 0,
  summaries,
  loveMeterTargets,
}: HomeContentProps) {
  const { sentinelRef, revealed } = useRevealOnScroll();

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
          // Reserved height keeps the page scrollable (so the observer can
          // fire) and prevents any layout jump when the real content mounts.
          <div aria-hidden="true" className="min-h-[220vh]" />
        )}
      </div>
    </>
  );
}
