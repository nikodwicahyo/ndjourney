"use client";

import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useInView, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Camera, Video, RefreshCw, Pause, Play } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { shuffle } from "@/lib/format";
import {
  getOptimizedImageUrl,
  getBlurImageUrl,
  getOptimizedVideoUrl,
  getVideoPosterUrl,
} from "@/lib/cloudinary-urls";

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
  const filtered = photos.filter((p) => p.isPublic !== false).slice(0, MAX_PHOTOS);
  // Open on a still image: autoplaying a video as slide 1 pulled 6 MB inside
  // the first seconds. Videos stay in the rotation, just not first.
  const firstImage = filtered.findIndex((p) => !p.isVideo);
  if (firstImage > 0) {
    return [filtered[firstImage], ...filtered.slice(0, firstImage), ...filtered.slice(firstImage + 1)];
  }
  return filtered;
}

export default function GallerySlideshow({ photos }: GallerySlideshowProps) {
  const initialPhotos = useMemo(() => selectSlideshowMedia(photos), [photos]);
  const [displayPhotos, setDisplayPhotos] = useState(initialPhotos);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  // Readiness is keyed by photo id: a late load/error event from the outgoing
  // slide can never mark the incoming one as ready.
  const [loadedPhotoId, setLoadedPhotoId] = useState<string | null>(null);
  const [failedPhotoId, setFailedPhotoId] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  // Reset the viewer when a new photo list arrives — render-time adjustment
  // (React-endorsed) instead of post-paint sync sets.
  const [prevInitialPhotos, setPrevInitialPhotos] = useState(initialPhotos);
  if (prevInitialPhotos !== initialPhotos) {
    setPrevInitialPhotos(initialPhotos);
    setDisplayPhotos(initialPhotos);
    setCurrentIndex(0);
    setDirection(1);
  }
  const goNextRef = useRef<() => void>(() => {});
  const dotsRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Videos are only mounted/played once the slideshow approaches the viewport:
  // autoplaying the first video downloaded ~6 MB while the page was still
  // loading its LCP image.
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const length = displayPhotos.length;
  const hasPhotos = length > 0;
  const photo = displayPhotos[currentIndex];

  // Derived from the elements themselves (see onLoad/onCanPlay below) — the
  // autoplay timer may only start once the current slide is actually shown.
  const mediaState: MediaState =
    photo && loadedPhotoId === photo.id
      ? "loaded"
      : photo && failedPhotoId === photo.id
        ? "error"
        : "loading";
  const mediaReady = mediaState !== "loading";

  const markLoaded = useCallback(() => {
    if (photo) setLoadedPhotoId(photo.id);
  }, [photo]);

  const markFailed = useCallback(() => {
    if (photo) setFailedPhotoId(photo.id);
  }, [photo]);

  const handleRetry = useCallback(() => {
    setFailedPhotoId(null);
  }, []);

  const blurPlaceholderUrl = useMemo(() => {
    if (!photo?.url) return "";
    return getBlurImageUrl(photo.url);
  }, [photo]);

  const goNext = useCallback(() => {
    if (length === 0) return;
    setDirection(1);
    if (currentIndex + 1 < length) {
      setCurrentIndex(currentIndex + 1);
      return;
    }
    // One loop done — reshuffle so the next pass is a new random order of the
    // server's random public sample (and never re-open with the slide just left).
    const lastId = photo?.id;
    setDisplayPhotos((list) => {
      const next = shuffle(list);
      if (next.length > 1 && next[0].id === lastId) {
        [next[0], next[1]] = [next[1], next[0]];
      }
      return next;
    });
    setCurrentIndex(0);
  }, [length, currentIndex, photo?.id]);

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

  // Autoplay is gated by the explicit pause button AND the current slide being
  // shown. useReducedMotion is true on desktops with OS animation effects off,
  // and the old hover-pause fired on desktop mice resting over the card — both
  // silently killed the timer (phones hit neither, which is why they advanced).
  // mediaReady keeps the dwell time from starting on a blank/loading slide.
  useEffect(() => {
    if (isPaused || !hasPhotos || !mediaReady) return;
    const id = setInterval(() => goNextRef.current(), 3000);
    return () => clearInterval(id);
  }, [isPaused, hasPhotos, mediaReady]);

  // Keep the active dot visible as autoplay/manual nav advances —
  // scroll the dots strip only (never the page), no state so
  // SSR/first paint stay identical. Rect math (not offsetLeft:
  // that's relative to the positioned card, wrong on narrow screens).
  useEffect(() => {
    const container = dotsRef.current;
    const active = container?.querySelector('[aria-current="true"]');
    if (!(container && active instanceof HTMLElement)) return;
    const containerRect = container.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    if (containerRect.width === 0) return;
    const target = Math.max(
      0,
      container.scrollLeft +
        (activeRect.left + activeRect.width / 2) -
        (containerRect.left + containerRect.width / 2),
    );
    if (typeof container.scrollTo === "function") {
      container.scrollTo({
        left: target,
        behavior: reduceMotion ? "auto" : "smooth",
      });
    } else {
      container.scrollLeft = target; // ponytail: jsdom fallback
    }
  }, [currentIndex, reduceMotion]);

  // ponytail: variants stay STATIC — MotionRoot disables the slide for
  // reduced-motion users. Branching here mismatches SSR vs first paint.
  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
  };

  if (!hasPhotos) {
    return (
      <div>
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
    <div ref={rootRef} data-testid="gallery-slideshow">
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
                  src={getOptimizedVideoUrl(photo.url, 720, { quality: "auto:eco" })}
                  poster={getVideoPosterUrl(photo.url, 720)}
                  autoPlay={inView}
                  loop
                  muted
                  playsInline
                  preload={inView ? "auto" : "none"}
                  onCanPlay={markLoaded}
                  onError={markFailed}
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
                    placeholder="blur"
                    blurDataURL={blurPlaceholderUrl}
                    onLoad={markLoaded}
                    onError={markFailed}
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

        <div className="flex items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4">
          <button
            onClick={() => setIsPaused((p) => !p)}
            aria-label={isPaused ? "Putar tayangan" : "Jeda tayangan"}
            aria-pressed={!isPaused}
            className="flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:min-h-[44px] sm:min-w-[44px]"
          >
            {isPaused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
          </button>
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            {currentIndex + 1} / {length}
          </span>
          <div ref={dotsRef} className="scrollbar-hide flex min-w-0 flex-1 snap-x snap-proximity items-center justify-start gap-0.5 overflow-x-auto scroll-px-6 px-1">
            {displayPhotos.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className="flex min-h-[24px] min-w-[24px] shrink-0 snap-center items-center justify-center px-1"
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
