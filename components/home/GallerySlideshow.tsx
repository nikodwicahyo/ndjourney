"use client";

import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Camera, Video, RefreshCw } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { getOptimizedImageUrl, getBlurImageUrl, getImageSrcSet } from "@/lib/cloudinary-urls";

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

type MediaState = "loading" | "loaded" | "error";

const MAX_PHOTOS = 50;

export default function GallerySlideshow({ photos }: GallerySlideshowProps) {
  const initialPhotos = useMemo(() => photos.slice(0, MAX_PHOTOS), [photos]);
  const [displayPhotos, setDisplayPhotos] = useState(initialPhotos);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [mediaState, setMediaState] = useState<MediaState>("loading");
  const [retryKey, setRetryKey] = useState(0);
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
  }, [photo?.url]);

  const blurPlaceholderUrl = useMemo(() => {
    if (!photo?.url) return "";
    return getBlurImageUrl(photo.url);
  }, [photo?.url]);

  const srcSet = useMemo(() => {
    if (!photo?.url) return undefined;
    try {
      return getImageSrcSet(photo.url);
    } catch {
      return undefined;
    }
  }, [photo?.url]);

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

  useEffect(() => {
    setDisplayPhotos(initialPhotos);
    setCurrentIndex(0);
    setDirection(1);
    setMediaState("loading");
    setRetryKey(0);
  }, [initialPhotos]);

  useEffect(() => {
    setMediaState("loading");
  }, [photo?.id]);

  const goNext = useCallback(() => {
    if (length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % length);
    setDirection(1);
  }, [length]);

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
    intervalRef.current = setInterval(() => goNextRef.current(), 3000);
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
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <AnimatePresence custom={direction} mode="wait">
            <motion.div
              key={photo.id}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: "easeInOut" }}
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
                  <img
                    src={mediaState === "loaded" ? fullUrl : blurPlaceholderUrl}
                    alt={photo.caption ?? "Gallery"}
                    className={cn(
                      "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
                      mediaState === "loading" ? "opacity-50" : "opacity-100",
                    )}
                    srcSet={mediaState === "loaded" ? srcSet : undefined}
                    sizes="(max-width: 768px) 100vw, 1024px"
                    decoding="async"
                    fetchPriority={currentIndex === 0 ? "high" : "auto"}
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
            {photo.takenAt && (
              <p className="mt-1 text-xs text-white/80 drop-shadow-md">
                {formatDate(photo.takenAt)}
              </p>
            )}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white shadow-md transition-colors hover:bg-black/70 md:p-2"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white shadow-md transition-colors hover:bg-black/70 md:p-2"
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
