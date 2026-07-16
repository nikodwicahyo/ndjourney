"use client";

import { useEffect, useCallback, useState, useMemo, useRef } from "react";
import Image from "next/image";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { getOptimizedImageUrl, getBlurImageUrl } from "@/lib/cloudinary-urls";
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

function preloadImage(url: string, as: string = "image", priority: "high" | "low" = "high") {
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = as;
  link.href = url;
  link.fetchPriority = priority;
  document.head.appendChild(link);
  preloadLinks.push(link);
}

function cleanupPreloads() {
  preloadLinks.forEach((link) => link.remove());
  preloadLinks.length = 0;
}

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
};

export default function Lightbox({
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
}: LightboxProps) {
  const [loaded, setLoaded] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const photo = photos[currentIndex];
  const videoRef = useRef<HTMLVideoElement>(null);
  const isVideoRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  const displayWidth = useMemo(() => {
    if (!photo?.width) return 1600;
    return Math.min(photo.width, 1600);
  }, [photo?.width]);

  const optimizedUrl = useMemo(() => {
    if (!photo?.url) return "";
    return getOptimizedImageUrl(photo.url, displayWidth, { crop: "limit" });
  }, [photo?.url, displayWidth]);

  const blurDataUrl = useMemo(() => {
    if (!photo?.url) return undefined;
    try {
      return getBlurImageUrl(photo.url);
    } catch {
      return undefined;
    }
  }, [photo?.url]);

  useEffect(() => {
    if (!photo?.url || photo.isVideo) return;
    cleanupPreloads();
    preloadImage(optimizedUrl, "image", "high");
    if (photos.length > 1) {
      const prevIdx = currentIndex > 0 ? currentIndex - 1 : photos.length - 1;
      const nextIdx = currentIndex < photos.length - 1 ? currentIndex + 1 : 0;
      const prevPhoto = photos[prevIdx];
      const nextPhoto = photos[nextIdx];
      if (prevPhoto?.url && !prevPhoto.isVideo) {
        preloadImage(getOptimizedImageUrl(prevPhoto.url, 1600, { crop: "limit" }), "image", "low");
      }
      if (nextPhoto?.url && !nextPhoto.isVideo) {
        preloadImage(getOptimizedImageUrl(nextPhoto.url, 1600, { crop: "limit" }), "image", "low");
      }
    }
    return cleanupPreloads;
  }, [currentIndex, photo?.url, photo?.isVideo, optimizedUrl, photos]);

  const handlePrev = useCallback(() => {
    if (isVideoRef.current) dispatchBgEvent("resume");
    const prevIndex = currentIndex === 0 ? photos.length - 1 : currentIndex - 1;
    setLoaded(false);
    loadedRef.current = false;
    setIsZoomed(false);
    onNavigate(prevIndex);
  }, [currentIndex, photos.length, onNavigate]);

  const handleNext = useCallback(() => {
    if (isVideoRef.current) dispatchBgEvent("resume");
    const atEnd = currentIndex >= photos.length - 1;
    if (atEnd) {
      if (hasNextPage && fetchNextPage) {
        fetchNextPage();
      }
      if (!hasNextPage) {
        const nextIndex = 0;
        setLoaded(false);
        loadedRef.current = false;
        setIsZoomed(false);
        onNavigate(nextIndex);
      }
      return;
    }
    const nextIndex = currentIndex + 1;
    setLoaded(false);
    loadedRef.current = false;
    setIsZoomed(false);
    onNavigate(nextIndex);
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

  const handleImageLoad = useCallback(() => {
    setLoaded(true);
    loadedRef.current = true;
  }, []);

  useEffect(() => {
    isVideoRef.current = photo?.isVideo ?? false;
  }, [photo]);

  useEffect(() => {
    setLoaded(false);
    loadedRef.current = false;
    setIsZoomed(false);
  }, [photo?.id]);

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
              {currentIndex + 1} / {photos.length}
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

        <div ref={containerRef} className="flex flex-1 overflow-hidden">
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
              "flex shrink-0 items-center justify-center",
              isZoomed ? "overflow-auto" : "",
            )}
            style={{ maxWidth: isZoomed ? "100%" : "85%" }}
          >
            {photo.isVideo ? (
              <video
                ref={videoRef}
                src={photo.url}
                controls
                preload="metadata"
                poster={getVideoPosterUrl(photo.url)}
                className="max-h-full max-w-full rounded-lg"
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
                {!loaded && (
                  <div className="absolute h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}
                <Image
                  src={optimizedUrl}
                  alt={photo.caption ?? "Photo"}
                  width={photo.width || displayWidth}
                  height={photo.height || (displayWidth * 2) / 3}
                  onLoad={handleImageLoad}
                  sizes={
                    isZoomed
                      ? "(max-width: 768px) 100vw, 90vw"
                      : "(max-width: 768px) 85vw, (max-width: 1200px) 70vw, 60vw"
                  }
                  placeholder={blurDataUrl ? "blur" : "empty"}
                  blurDataURL={blurDataUrl}
                  unoptimized
                  loading="eager"
                  className={cn(
                    "transition-opacity duration-300",
                    isZoomed
                      ? "h-auto w-full max-w-none object-contain"
                      : "max-h-[80vh] w-auto rounded-lg object-contain",
                    loaded ? "opacity-100" : "opacity-0",
                  )}
                  onClick={toggleZoom}
                  style={
                    isZoomed
                      ? { maxWidth: "none", maxHeight: "none", width: "100%", height: "auto" }
                      : { maxWidth: "100%", height: "auto" }
                  }
                />
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
