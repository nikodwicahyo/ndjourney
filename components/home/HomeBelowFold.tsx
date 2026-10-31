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
import Reveal from "./Reveal";
import MotionRoot from "@/components/MotionRoot";
import { SECTION_SLOTS } from "./section-slots";
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

const HEIGHTS = Object.fromEntries(
  SECTION_SLOTS.map((slot) => [slot.key, slot.minHeight]),
) as Record<(typeof SECTION_SLOTS)[number]["key"], number>;

// Everything below the hero. The chunk is loaded on demand (see HomeContent)
// and each section inside mounts only as it approaches the viewport — mounting
// all nine widgets at once measured as a multi-hundred-ms long task, which is
// exactly the stall a visitor felt when they started scrolling.
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
    <MotionRoot>
      <div className="space-y-16 md:space-y-24">
      <Reveal minHeight={HEIGHTS.location}>
        <Suspense fallback={<div className="h-24 animate-pulse rounded-2xl bg-muted" />}>
          <LocationWidget />
        </Suspense>
      </Reveal>

      {coupleConfig?.anniversaryDate ? (
        <Reveal minHeight={HEIGHTS.countdown}>
          <CountdownTimer
            anniversaryDate={coupleConfig.anniversaryDate}
            name1={coupleConfig.name1}
            name2={coupleConfig.name2}
          />
        </Reveal>
      ) : null}

      <Reveal minHeight={HEIGHTS.birthday1}>
        <BirthdayCountdown
          birthDate={coupleConfig?.birthDate1 ?? null}
          name={coupleConfig?.name1 ?? ""}
        />
      </Reveal>

      <Reveal minHeight={HEIGHTS.birthday2}>
        <BirthdayCountdown
          birthDate={coupleConfig?.birthDate2 ?? null}
          name={coupleConfig?.name2 ?? ""}
        />
      </Reveal>

      <Reveal minHeight={HEIGHTS.quote}>
        <QuoteOfTheDay />
      </Reveal>

      <Reveal minHeight={HEIGHTS.gallery}>
        <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
          <GallerySlideshow photos={galleryPhotos} />
        </Suspense>
      </Reveal>

      <Reveal minHeight={HEIGHTS["love-meter"]}>
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
      </Reveal>

      <Reveal minHeight={HEIGHTS["bottle-letter"]}>
        <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-muted" />}>
          <BottleLetter />
        </Suspense>
      </Reveal>

      <Reveal minHeight={HEIGHTS["memory-match"]}>
        <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
          <MemoryMatch photos={galleryPhotos} />
        </Suspense>
      </Reveal>

      <Reveal minHeight={HEIGHTS["daily-task"]}>
        <Suspense fallback={<div className="h-32 animate-pulse rounded-2xl bg-muted" />}>
          <DailyLoveTask />
        </Suspense>
      </Reveal>
    </div>
    </MotionRoot>
  );
}
