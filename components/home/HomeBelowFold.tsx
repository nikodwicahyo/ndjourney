"use client";

import { Suspense, useMemo } from "react";
import CountdownTimer from "./CountdownTimer";
import BirthdayCountdown from "./BirthdayCountdown";
import QuoteOfTheDay from "./QuoteOfTheDay";
import GallerySlideshow from "./GallerySlideshow";
import LoveMeter from "./LoveMeter";
import DailyLoveTask from "./DailyLoveTask";
import BottleLetter from "./BottleLetter";
import MemoryMatch from "./MemoryMatch";
import LocationWidget from "@/components/location/LocationWidget";
import type { GalleryPhoto } from "./GallerySlideshow";
import type { HomeSummaries } from "./HomeStats";
import type { LoveMeterState } from "@/lib/love-meter";

type HomeBelowFoldProps = {
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
  loveMeterTargets: LoveMeterState;
};

// Everything below the hero. Loaded on demand (see HomeContent) so the first
// screen doesn't pay for nine interactive widgets, their effects, and the
// framer-motion runtime — measured as ~3 s of render delay on a throttled phone.
export default function HomeBelowFold({
  coupleConfig,
  galleryPhotos,
  photoCount = 0,
  summaries,
  loveMeterTargets,
}: HomeBelowFoldProps) {
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
    <div className="space-y-16 md:space-y-24">
      <section>
        <Suspense fallback={<div className="h-24 animate-pulse rounded-2xl bg-muted" />}>
          <LocationWidget />
        </Suspense>
      </section>
      <section>
        {coupleConfig?.anniversaryDate ? (
          <CountdownTimer
            anniversaryDate={coupleConfig.anniversaryDate}
            name1={coupleConfig?.name1}
            name2={coupleConfig?.name2}
          />
        ) : null}
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
        <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-muted" />}>
          <LoveMeter
            daysTogether={daysTogether}
            milestoneCount={summaries.timeline.milestoneCount}
            noteCount={summaries.notes.noteCount}
            letterCount={summaries.letters.totalCount}
            wishProgress={wishProgress}
            wishDone={summaries.wishlist.done}
            wishTotal={summaries.wishlist.total}
            photoCount={photoCount}
            targetMilestones={loveMeterTargets.targetMilestones}
            targetNotes={loveMeterTargets.targetNotes}
            targetLetters={loveMeterTargets.targetLetters}
            targetPhotos={loveMeterTargets.targetPhotos}
            targetSetAt={loveMeterTargets.targetSetAt?.toISOString() ?? null}
            targetMetAt={loveMeterTargets.targetMetAt?.toISOString() ?? null}
          />
        </Suspense>
      </section>

      <section>
        <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
          <GallerySlideshow photos={galleryPhotos} />
        </Suspense>
      </section>

      <section>
        <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-muted" />}>
          <BottleLetter />
        </Suspense>
      </section>

      <section>
        <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
          <MemoryMatch photos={galleryPhotos} />
        </Suspense>
      </section>

      <section>
        <Suspense fallback={<div className="h-32 animate-pulse rounded-2xl bg-muted" />}>
          <DailyLoveTask />
        </Suspense>
      </section>
    </div>
  );
}
