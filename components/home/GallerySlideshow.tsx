"use client";

import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Camera, Video, RefreshCw, Pause, Play } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { getOptimizedImageUrl, getBlurImageUrl } from "@/lib/cloudinary-urls";

export type GalleryPhoto = {
  id: string;
  url: string;
  caption?: string | null;
  createdAt?: string | null;
  isVideo: boolean;
  isPublic?: boolean;
};

type GallerySlideshowProps = {
  photos: GalleryPhoto[];
};

type MediaState = "loading" | "loaded" | "error";

const MAX_PHOTOS = 50;

// next/image loader reusing the existing Cloudinary transforms (q_auto,
// f_auto, per-width) — same bytes as the former manual srcSet, no Vercel
// optimization cost, responsive widths via `sizes` below.
function cloudinaryWidthLoader({ src, width }: { src: string; width: number }) {
  return getOptimizedImageUrl(src, width, { crop: "limit" });
}

// single gate — home is public, private rows must never render
// here even if a caller passes an unfiltered list (isPublic missing = public).
export function selectSlideshowMedia(photos: GalleryPhoto[]): GalleryPhoto[] {
  return photos.filter((p) => p.isPublic !== false).slice(0, MAX_PHOTOS);
}

export default function GallerySlideshow({ photos }: GallerySlideshowProps) {
  const initialPhotos = useMemo(() => selectSlideshowMedia(photos), [photos]);
  const [displayPhotos, setDisplayPhotos] = useState(initialPhotos);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [mediaState, setMediaState] = useState<MediaState>("loading");
  const [retryKey, setRetryKey] = useState(0);
  const reduceMotion = useReducedMotion();
  // Reset the viewer when a new photo list arrives — render-time adjustment
  // (React-endorsed) instead of post-paint sync sets.
  const [prevInitialPhotos, setPrevInitialPhotos] = useState(initialPhotos);
  if (prevInitialPhotos !== initialPhotos) {
    setPrevInitialPhotos(initialPhotos);
    setDisplayPhotos(initialPhotos);
    setCurrentIndex(0);
    setDirection(1);
    setMediaState("loading");
    setRetryKey(0);
  }
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const goNextRef = useRef<() => void>(() => {});
  const length = displayPhotos.length;
  const hasPhotos = length > 0;
  const photo = displayPhotos[currentIndex];

  const handleRetry = useCallback(() => {
    setMediaState("loading");
    setRetryKey((k) => k + 1);
  }, []);

  const fullUrl = useMemo(() => {
    if (!photo?.url) return "";
    return getOptimizedImageUrl(photo.url, 1024, { crop: "limit" });
  }, [photo]);

  const blurPlaceholderUrl = useMemo(() => {
    if (!photo?.url) return "";
    return getBlurImageUrl(photo.url);
  }, [photo]);

  useEffect(() => {
    if (!photo?.url || photo.isVideo) return;
    let cancelled = false;
    const img = new window.Image();
    img.onload = () => {
      if (!cancelled) setMediaState("loaded");
    };
    img.onerror = () => {
      if (!cancelled) setMediaState("error");
    };
    img.src = fullUrl;
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [photo?.id, photo?.url, fullUrl, photo?.isVideo, retryKey]);

  // Reset the loading state when the photo changes — render-time adjustment
  // (React-endorsed) instead of a post-paint sync set.
  const [prevPhotoId, setPrevPhotoId] = useState(photo?.id);
  if (prevPhotoId !== photo?.id) {
    setPrevPhotoId(photo?.id);
    setMediaState("loading");
  }

  const goNext = useCallback(() => {
    if (length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % length);
    setDirection(1);
  }, [length]);

  // Keep the latest navigator for timers/observers without re-subscribing —
  // assigned inside an effect, never during render.
  useEffect(() => {
    goNextRef.current = goNext;
  });

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
    if (isPaused || reduceMotion || !hasPhotos) return;
    intervalRef.current = setInterval(() => goNextRef.current(), 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused, reduceMotion, hasPhotos]);

  // ponytail: variants stay STATIC — MotionRoot disables the slide for
  // reduced-motion users. Branching here mismatches SSR vs first paint.
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
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <AnimatePresence custom={direction} mode="wait">
            <motion.div
              key={photo.id}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: reduceMotion ? 0 : 0.35, ease: "easeInOut" }}
              className="absolute inset-0"
            >
              {photo.isVideo ? (
                <video
                  src={photo.url}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                />
              ) : mediaState === "error" ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-muted">
                  <p className="text-xs text-muted-foreground">Gagal memuat</p>
                  <button
                    onClick={handleRetry}
                    className="flex items-center gap-1.5 rounded-full bg-foreground/10 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-foreground/20"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Muat ulang
                  </button>
                </div>
              ) : (
                <>
                  {mediaState === "loading" && (
                    <div className="absolute inset-0 z-10 animate-pulse bg-muted" />
                  )}
                  <Image
                    loader={cloudinaryWidthLoader}
                    src={photo.url}
                    alt={photo.caption ?? `Foto galeri ${currentIndex + 1} dari ${length}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 1024px"
                    priority={currentIndex === 0}
                    placeholder="blur"
                    blurDataURL={blurPlaceholderUrl}
                    className={cn(
                      "object-cover transition-opacity duration-500",
                      mediaState === "loading" ? "opacity-50" : "opacity-100",
                    )}
                  />
                </>
              )}
              {photo.isVideo && (
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
            {photo.createdAt && (
              <p className="mt-1 text-xs text-white/80 drop-shadow-md">
                {formatDate(photo.createdAt)}
              </p>
            )}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-2 top-1/2 z-10 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white shadow-md transition-colors hover:bg-black/70"
            aria-label="Sebelumnya"
          >
            <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" aria-hidden="true" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-2 top-1/2 z-10 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white shadow-md transition-colors hover:bg-black/70"
            aria-label="Berikutnya"
          >
            <ChevronRight className="h-4 w-4 md:h-5 md:w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => setIsPaused((p) => !p)}
            aria-label={isPaused ? "Putar tayangan" : "Jeda tayangan"}
            aria-pressed={!isPaused}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {isPaused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
          </button>
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            {currentIndex + 1} / {length}
          </span>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 overflow-hidden">
            {displayPhotos.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center"
                aria-label={`Ke slide ${i + 1}`}
                aria-current={i === currentIndex}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "rounded-full transition-all duration-300",
                    i === currentIndex
                      ? "h-2 w-5 bg-primary"
                      : "h-1.5 w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50",
                  )}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
