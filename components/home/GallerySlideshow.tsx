"use client";

import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Camera, Video } from "lucide-react";
import { cn, formatDate, isVideoUrl } from "@/lib/utils";

export type GalleryPhoto = {
  id: string;
  url: string;
  caption?: string | null;
  takenAt?: string | null;
  isVideo: boolean;
};

type GallerySlideshowProps = {
  photos: GalleryPhoto[];
};

const MAX_PHOTOS = 30;

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function GallerySlideshow({ photos }: GallerySlideshowProps) {
  const initialPhotos = useMemo(() => photos.slice(0, MAX_PHOTOS), [photos]);
  const [displayPhotos, setDisplayPhotos] = useState(initialPhotos);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const goNextRef = useRef<() => void>(() => {});
  const length = displayPhotos.length;
  const hasPhotos = length > 0;
  const photo = displayPhotos[currentIndex];
  const photoIsVideo = photo ? isVideoUrl(photo.url) : false;

  useEffect(() => {
    setDisplayPhotos(initialPhotos);
    setCurrentIndex(0);
    setDirection(1);
  }, [initialPhotos]);

  const shuffle = useCallback(() => {
    setDisplayPhotos((prev) => shuffleArray(prev));
  }, []);

  const goNext = useCallback(() => {
    if (length === 0) return;
    setCurrentIndex((prev) => {
      const next = (prev + 1) % length;
      if (next === 0) shuffle();
      return next;
    });
    setDirection(1);
  }, [length, shuffle]);

  goNextRef.current = goNext;

  const goPrev = useCallback(() => {
    if (length === 0) return;
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + length) % length);
  }, [length]);

  const goTo = useCallback((index: number) => {
    if (length === 0) return;
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  }, [length, currentIndex]);

  useEffect(() => {
    if (isPaused || !hasPhotos) return;
    intervalRef.current = setInterval(() => goNextRef.current(), 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused, hasPhotos]);

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
  };

  if (!hasPhotos) {
    return (
      <div className="px-4">
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16">
          <Camera className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Belum ada media di gallery.
          </p>
          <p className="text-xs text-muted-foreground">
            Upload foto atau video untuk memulai cerita.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="px-4"
      onPointerEnter={() => setIsPaused(true)}
      onPointerLeave={() => setIsPaused(false)}
      onPointerCancel={() => setIsPaused(false)}
    >
      <div className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="relative aspect-[4/3] overflow-hidden">
          <AnimatePresence custom={direction} mode="wait">
            <motion.div
              key={photo.id + currentIndex}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="absolute inset-0"
            >
              {photoIsVideo ? (
                <video
                  src={photo.url}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                />
              ) : (
                <Image
                  src={photo.url}
                  alt={photo.caption ?? "Gallery"}
                  fill
                  sizes="(max-width: 768px) 100vw, 512px"
                  className="object-cover"
                />
              )}
              {photoIsVideo && (
                <div className="absolute top-3 right-3 rounded-full bg-black/60 p-1.5">
                  <Video className="h-4 w-4 text-white" />
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

          <div className="absolute bottom-4 left-4 right-4">
            {photo.caption && (
              <p className="text-sm font-medium text-white drop-shadow-md">
                {photo.caption}
              </p>
            )}
            {photo.takenAt && (
              <p className="mt-1 text-xs text-white/80 drop-shadow-md">
                {formatDate(photo.takenAt)}
              </p>
            )}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white/80 opacity-0 transition-opacity hover:bg-black/60 hover:text-white group-hover:opacity-100 md:p-2"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white/80 opacity-0 transition-opacity hover:bg-black/60 hover:text-white group-hover:opacity-100 md:p-2"
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4 md:h-5 md:w-5" />
          </button>
        </div>

        <div className="flex items-center gap-3 px-4 py-3">
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            {currentIndex + 1} / {length}
          </span>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 overflow-hidden">
            {displayPhotos.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={cn(
                  "shrink-0 rounded-full transition-all duration-300",
                  i === currentIndex
                    ? "h-2 w-5 bg-primary"
                    : "h-1.5 w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50",
                )}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
