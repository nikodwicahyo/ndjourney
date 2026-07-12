"use client";

import { useMemo } from "react";
import HeroSection from "./HeroSection";
import CountdownTimer from "./CountdownTimer";
import BirthdayCountdown from "./BirthdayCountdown";
import QuoteOfTheDay from "./QuoteOfTheDay";
import GallerySlideshow from "./GallerySlideshow";
import LoveMeter from "./LoveMeter";
import DailyLoveTask from "./DailyLoveTask";
import BottleLetter from "./BottleLetter";
import MemoryMatch from "./MemoryMatch";
import ClickHearts from "./ClickHearts";
import type { GalleryPhoto } from "./GallerySlideshow";
import type { HomeSummaries } from "./HomeStats";

type HomeContentProps = {
  coupleConfig: {
    name1: string;
    name2: string;
    tagline?: string | null;
    heroPhotoUrl?: string | null;
    anniversaryDate: string;
    birthDate1?: string | null;
    birthDate2?: string | null;
  } | null;
  galleryPhotos: GalleryPhoto[];
  photoCount?: number;
  summaries: HomeSummaries;
};

export default function HomeContent({
  coupleConfig,
  galleryPhotos,
  photoCount = 0,
  summaries,
}: HomeContentProps) {
  const daysTogether = useMemo(() => {
    if (!coupleConfig?.anniversaryDate) return 0;
    const target = new Date(coupleConfig.anniversaryDate);
    const now = new Date();
    const diffMs = now.getTime() - target.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }, [coupleConfig]);

  const wishProgress = useMemo(() => {
    const { total, done } = summaries.wishlist;
    return total > 0 ? done / total : 0;
  }, [summaries.wishlist]);

  return (
    <>
      <ClickHearts />

      <HeroSection
        name1={coupleConfig?.name1}
        name2={coupleConfig?.name2}
        tagline={coupleConfig?.tagline}
        heroPhotoUrl={coupleConfig?.heroPhotoUrl}
      />

      <div className="space-y-16 md:space-y-24">
        <section>
          <CountdownTimer
            anniversaryDate={coupleConfig?.anniversaryDate ?? new Date().toISOString()}
            name1={coupleConfig?.name1}
            name2={coupleConfig?.name2}
          />
        </section>

        <section>
          <BirthdayCountdown
            birthDate={coupleConfig?.birthDate1 ?? null}
            name={coupleConfig?.name1 ?? ""}
          />
        </section>

        <section>
          <BirthdayCountdown
            birthDate={coupleConfig?.birthDate2 ?? null}
            name={coupleConfig?.name2 ?? ""}
          />
        </section>

        <section>
          <QuoteOfTheDay />
        </section>

        <section>
          <LoveMeter
            daysTogether={daysTogether}
            milestoneCount={summaries.timeline.milestoneCount}
            noteCount={summaries.notes.noteCount}
            letterCount={summaries.letters.totalCount}
            wishProgress={wishProgress}
            wishDone={summaries.wishlist.done}
            wishTotal={summaries.wishlist.total}
            photoCount={photoCount}
          />
        </section>

        <section>
          <GallerySlideshow photos={galleryPhotos} />
        </section>

        <section>
          <BottleLetter />
        </section>

        <section>
          <MemoryMatch photos={galleryPhotos} />
        </section>

        <section>
          <DailyLoveTask />
        </section>
      </div>
    </>
  );
}
