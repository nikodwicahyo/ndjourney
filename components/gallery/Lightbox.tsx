"use client";

import { memo, useEffect, useCallback, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Heart,
  Download,
  Trash2,
  File,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RefreshCw,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import {
  getOptimizedImageUrl,
  getImageSrcSet,
  getOptimizedVideoUrl,
  getBlurImageUrl,
} from "@/lib/cloudinary-urls";
import type { Photo } from "@/types";
import AlbumMoveDropdown from "./AlbumMoveDropdown";

function dispatchBgEvent(type: "pause" | "resume") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(`media:${type}-bg-audio`));
}

function getVideoPosterUrl(videoUrl: string, width = 800): string {
  const match = videoUrl.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+)\/video\/upload\/(.*)$/);
  if (!match) return videoUrl;
  const [, base, rest] = match;
  const firstSlash = rest.indexOf("/");
  const publicId = rest.includes(",") && firstSlash >= 0 ? rest.slice(firstSlash + 1) : rest;
  return `${base}/image/upload/so_0,w_${width},c_limit,q_auto,f_auto/${publicId}.jpg`;
}

const preloadLinks: HTMLLinkElement[] = [];

function cleanupPreloads() {
  preloadLinks.forEach((link) => link.remove());
  preloadLinks.length = 0;
}

type MediaState = "loading" | "loaded" | "error";

type LightboxProps = {
  photos: Photo[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onFavoriteToggle?: (id: string, isFavorite: boolean) => void;
  onDelete?: (id: string) => void;
  showAlbumMove?: boolean;
  fetchNextPage?: () => void;
  hasNextPage?: boolean;
  totalCount?: number;
};

function Lightbox({
  photos,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
  onFavoriteToggle,
  onDelete,
  showAlbumMove = false,
  fetchNextPage,
  hasNextPage,
  totalCount,
}: LightboxProps) {
  const [mediaState, setMediaState] = useState<MediaState>("loading");
  const [retryKey, setRetryKey] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [direction, setDirection] = useState(1);
  const photo = photos[currentIndex];
  const videoRef = useRef<HTMLVideoElement>(null);
  const isVideoRef = useRef(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const isFetchingRef = useRef(false);
  const currentIndexRef = useRef(currentIndex);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const handleRetry = useCallback(() => {
    setMediaState("loading");
    setRetryKey((k) => k + 1);
  }, []);

  const displayWidth = useMemo(() => {
    if (!photo?.width) return 1200;
    if (typeof window === "undefined") return Math.min(photo.width, 1200);
    const vw = window.innerWidth;
    const dpr = window.devicePixelRatio || 1;
    const target = Math.round(vw * dpr * 0.85);
    const clamped = Math.max(640, Math.min(target, 1600));
    return Math.min(photo.width, clamped);
  }, [photo?.width]);

  const optimizedUrl = useMemo(() => {
    if (!photo?.url) return "";
    const quality = isZoomed ? "auto:best" : "auto:eco";
    return getOptimizedImageUrl(photo.url, displayWidth, { quality, crop: "limit" });
  }, [photo?.url, displayWidth, isZoomed]);

  const blurPlaceholderUrl = useMemo(() => {
    if (!photo?.url) return "";
    return getBlurImageUrl(photo.url);
  }, [photo?.url]);

  const srcSet = useMemo(() => {
    if (!photo?.url) return undefined;
    try {
      const quality = isZoomed ? "auto:best" : "auto:eco";
      return getImageSrcSet(photo.url, { quality });
    } catch {
      return undefined;
    }
  }, [photo?.url, isZoomed]);

  useEffect(() => {
    if (!isOpen) return;
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = "https://res.cloudinary.com";
    document.head.appendChild(link);
    return () => link.remove();
  }, [isOpen]);

  useEffect(() => {
    if (!photo?.url || photo.isVideo) return;
    cleanupPreloads();
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = optimizedUrl;
    link.fetchPriority = "high";
    document.head.appendChild(link);
    preloadLinks.push(link);
    if (photos.length > 1) {
      const prevIdx = currentIndex > 0 ? currentIndex - 1 : photos.length - 1;
      const nextIdx = currentIndex < photos.length - 1 ? currentIndex + 1 : 0;
      const prevPhoto = photos[prevIdx];
      const nextPhoto = photos[nextIdx];
      const adjQuality = "auto:eco";
      if (prevPhoto?.url && !prevPhoto.isVideo) {
        const prevUrl = getOptimizedImageUrl(prevPhoto.url, 800, { quality: adjQuality, crop: "limit" });
        const pl = document.createElement("link");
        pl.rel = "preload";
        pl.as = "image";
        pl.href = prevUrl;
        pl.fetchPriority = "low";
        document.head.appendChild(pl);
        preloadLinks.push(pl);
      }
      if (nextPhoto?.url && !nextPhoto.isVideo) {
        const nextUrl = getOptimizedImageUrl(nextPhoto.url, 800, { quality: adjQuality, crop: "limit" });
        const pl = document.createElement("link");
        pl.rel = "preload";
        pl.as = "image";
        pl.href = nextUrl;
        pl.fetchPriority = "low";
        document.head.appendChild(pl);
        preloadLinks.push(pl);
      }
    }
    return cleanupPreloads;
  }, [currentIndex, photo?.url, photo?.isVideo, optimizedUrl, photos]);

  const slideVariants = useMemo(() => ({
    enter: (dir: number) => ({
      x: dir > 0 ? 350 : -350,
    }),
    center: { x: 0 },
    exit: (dir: number) => ({
      x: dir > 0 ? -350 : 350,
    }),
  }), []);

  const handlePrev = useCallback(() => {
    if (isVideoRef.current) dispatchBgEvent("resume");
    if (currentIndex === 0) return;
    setDirection(-1);
    setIsZoomed(false);
    onNavigate(currentIndex - 1);
  }, [currentIndex, onNavigate]);

  const handleNext = useCallback(async () => {
    if (isVideoRef.current) dispatchBgEvent("resume");
    setDirection(1);
    const atEnd = currentIndex >= photos.length - 1;
    if (atEnd) {
      if (hasNextPage && fetchNextPage && !isFetchingRef.current) {
        isFetchingRef.current = true;
        try {
          await fetchNextPage();
          if (currentIndexRef.current === currentIndex) {
            setIsZoomed(false);
            onNavigate(currentIndex + 1);
          }
        } finally {
          isFetchingRef.current = false;
        }
      }
      return;
    }
    setIsZoomed(false);
    onNavigate(currentIndex + 1);
  }, [currentIndex, photos.length, onNavigate, hasNextPage, fetchNextPage]);

  const handleClose = useCallback(() => {
    if (isVideoRef.current) dispatchBgEvent("resume");
    setIsZoomed(false);
    onClose();
  }, [onClose]);

  const handleDownload = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!photo?.url) return;
    try {
      const response = await fetch(photo.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const filename = photo.url.split("/").pop() || "download";
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Gagal mendownload file:", err);
      window.open(photo.url, "_blank");
    }
  }, [photo?.url]);

  const toggleZoom = useCallback(() => {
    if (!photo?.isVideo) {
      setIsZoomed((prev) => !prev);
    }
  }, [photo?.isVideo]);

  useEffect(() => {
    isVideoRef.current = photo?.isVideo ?? false;
  }, [photo]);

  useEffect(() => {
    setMediaState("loading");
    setIsZoomed(false);
  }, [photo?.id]);

  useEffect(() => {
    if (!photo?.url || photo.isVideo) return;
    let cancelled = false;
    const img = new window.Image();
    img.onload = () => {
      if (!cancelled) {
        setMediaState("loaded");
      }
    };
    img.onerror = () => {
      if (!cancelled) {
        setMediaState("error");
      }
    };
    img.src = getOptimizedImageUrl(photo.url, displayWidth, { quality: "auto:eco", crop: "limit" });
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [photo?.id, photo?.url, displayWidth, photo?.isVideo, retryKey]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          if (isZoomed) {
            setIsZoomed(false);
          } else {
            handleClose();
          }
          break;
        case "ArrowLeft":
          handlePrev();
          break;
        case "ArrowRight":
          handleNext();
          break;
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleClose, handlePrev, handleNext, isZoomed]);

  if (!isOpen || !photo) return null;

  const isImage = photo.url.includes("/image/upload/");
  const fileName = photo.caption || photo.publicId.split("/").pop() || "File";

  return (
    <AnimatePresence>
      <motion.div
        key="lightbox-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 flex flex-col bg-black/95"
      >
        <div className="relative z-10 flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <span className="text-sm text-white/60">
              {currentIndex + 1} / {totalCount ?? photos.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {!photo.isVideo && (
              <button
                onClick={toggleZoom}
                className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/10"
                aria-label={isZoomed ? "Zoom out" : "Zoom in"}
              >
                {isZoomed ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}
              </button>
            )}
            {onFavoriteToggle && (
              <button
                onClick={() => onFavoriteToggle(photo.id, !photo.isFavorite)}
                className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/10"
                aria-label="Toggle favorite"
              >
                <Heart
                  className={cn("h-5 w-5", photo.isFavorite && "fill-primary text-primary")}
                />
              </button>
            )}
            {showAlbumMove && (
              <AlbumMoveDropdown photoId={photo.id} currentAlbumId={photo.albumId} />
            )}
            <button
              onClick={handleDownload}
              className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/10"
              aria-label="Download"
            >
              <Download className="h-5 w-5" />
            </button>
            {onDelete && (
              <button
                onClick={() => onDelete(photo.id)}
                className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-destructive"
                aria-label="Hapus media"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div
            onClick={!isZoomed ? handlePrev : undefined}
            className={cn(
              "flex cursor-pointer items-center justify-start pl-1 sm:pl-2",
              isZoomed && "cursor-default",
            )}
            style={{ flex: "1 1 0" }}
          >
            {!isZoomed && (
              <button
                className="rounded-full bg-black/40 p-1.5 text-white/80 transition-colors hover:bg-black/60 hover:text-white sm:p-2"
                aria-label="Previous"
              >
                <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
              </button>
            )}
          </div>

          <div
            className={cn(
              "grid shrink-0 place-items-center overflow-hidden",
              isZoomed ? "overflow-auto" : "",
            )}
            style={{ maxWidth: isZoomed ? "100%" : "85%" }}
          >
            <AnimatePresence initial={false} custom={direction}>
              <motion.div
                key={photo.isVideo ? `v-${photo.id}` : `i-${photo.id}`}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ x: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } }}
                className="col-start-1 row-start-1 flex items-center justify-center"
                style={{ willChange: "transform" }}
              >
                {photo.isVideo ? (
                  <video
                    ref={videoRef}
                    src={getOptimizedVideoUrl(photo.url)}
                    controls
                    preload="metadata"
                    poster={getVideoPosterUrl(photo.url)}
                    className="max-h-[80vh] w-auto rounded-lg object-contain"
                    autoPlay
                    onPlay={() => dispatchBgEvent("pause")}
                    onPause={() => dispatchBgEvent("resume")}
                    onEnded={() => dispatchBgEvent("resume")}
                  />
                ) : isImage ? (
                  <div
                    className={cn(
                      "relative flex items-center justify-center",
                      isZoomed ? "h-full w-full" : "max-h-[80vh] max-w-full",
                    )}
                  >
                    {mediaState === "loading" && (
                      <div
                        className={cn(
                          "absolute inset-0 z-10 animate-pulse bg-white/20",
                          isZoomed ? "" : "rounded-lg",
                        )}
                      />
                    )}

                    {mediaState === "error" ? (
                      <div className="flex flex-col items-center gap-4 text-white/70">
                        <p className="text-sm">Gagal memuat gambar</p>
                        <button
                          onClick={handleRetry}
                          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/20"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Muat ulang
                        </button>
                      </div>
                    ) : (
                      <img
                        ref={imgRef}
                        src={mediaState === "loaded" ? optimizedUrl : blurPlaceholderUrl}
                        alt={photo.caption ?? "Photo"}
                        srcSet={mediaState === "loaded" ? srcSet : undefined}
                        sizes={
                          isZoomed
                            ? "(max-width: 768px) 100vw, 90vw"
                            : "(max-width: 768px) 85vw, (max-width: 1200px) 70vw, 60vw"
                        }
                        decoding="async"
                        fetchPriority={mediaState === "loading" ? "low" : "high"}
                        onClick={toggleZoom}
                        className={cn(
                          "transition-opacity duration-500",
                          mediaState === "loading" ? "opacity-40" : "opacity-100",
                          isZoomed
                            ? "h-auto w-full max-w-none object-contain"
                            : "max-h-[80vh] w-auto rounded-lg object-contain",
                        )}
                        style={
                          isZoomed
                            ? { maxWidth: "none", maxHeight: "none", width: "100%", height: "auto" }
                            : { maxWidth: "100%", height: "auto" }
                        }
                      />
                    )}
                  </div>
                ) : (
                  <div className="flex max-w-sm flex-col items-center gap-4 rounded-lg border border-white/10 bg-white/5 p-6 text-center">
                    <File className="h-12 w-12 text-white/70" />
                    <div>
                      <p className="break-all text-sm font-medium text-white">{fileName}</p>
                      <p className="mt-1 text-xs text-white/50">Preview tidak tersedia untuk tipe file ini.</p>
                    </div>
                    <a
                      href={photo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/90"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Buka file
                    </a>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div
            onClick={!isZoomed ? handleNext : undefined}
            className={cn(
              "flex cursor-pointer items-center justify-end pr-1 sm:pr-2",
              isZoomed && "cursor-default",
            )}
            style={{ flex: "1 1 0" }}
          >
            {!isZoomed && (
              <button
                className="rounded-full bg-black/40 p-1.5 text-white/80 transition-colors hover:bg-black/60 hover:text-white sm:p-2"
                aria-label="Next"
              >
                <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex-1">
            {photo.caption && (
              <p className="text-sm text-white/90">{photo.caption}</p>
            )}
            <div className="mt-1 flex items-center gap-3 text-xs text-white/50">
              {photo.takenAt && <span>{formatDate(photo.takenAt)}</span>}
              {photo.width && photo.height && (
                <span>
                  {photo.width} x {photo.height}
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default memo(Lightbox);
