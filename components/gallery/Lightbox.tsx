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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { getBlurImageUrl } from "@/lib/cloudinary-urls";
import type { Photo } from "@/types";
import AlbumMoveDropdown from "./AlbumMoveDropdown";

function dispatchBgEvent(type: "pause" | "resume") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(`media:${type}-bg-audio`));
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
}: LightboxProps) {
  const [loaded, setLoaded] = useState(false);
  const photo = photos[currentIndex];
  const videoRef = useRef<HTMLVideoElement>(null);
  const isVideoRef = useRef(false);

  const blurDataUrl = useMemo(() => {
    if (!photo?.url) return undefined;
    try {
      return getBlurImageUrl(photo.url);
    } catch {
      return undefined;
    }
  }, [photo?.url]);

  const handlePrev = useCallback(() => {
    if (isVideoRef.current) dispatchBgEvent("resume");
    const prevIndex = currentIndex === 0 ? photos.length - 1 : currentIndex - 1;
    setLoaded(false);
    onNavigate(prevIndex);
  }, [currentIndex, photos.length, onNavigate]);

  const handleNext = useCallback(() => {
    if (isVideoRef.current) dispatchBgEvent("resume");
    const nextIndex = currentIndex === photos.length - 1 ? 0 : currentIndex + 1;
    setLoaded(false);
    onNavigate(nextIndex);
  }, [currentIndex, photos.length, onNavigate]);

  const handleClose = useCallback(() => {
    if (isVideoRef.current) dispatchBgEvent("resume");
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

  useEffect(() => {
    isVideoRef.current = photo?.isVideo ?? false;
  }, [photo]);

  useEffect(() => {
    setLoaded(false);
  }, [photo?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          handleClose();
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
  }, [isOpen, handleClose, handlePrev, handleNext]);

  if (!isOpen || !photo) return null;

  const isFirst = currentIndex === 0;
  const isLast = currentIndex === photos.length - 1;
  const isImage = photo.url.includes("/image/upload/");
  const fileName = photo.caption || photo.publicId.split("/").pop() || "File";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
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
            {onFavoriteToggle && (
              <button
                onClick={() =>
                  onFavoriteToggle(photo.id, !photo.isFavorite)
                }
                className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/10"
                aria-label="Toggle favorite"
              >
                <Heart
                  className={cn(
                    "h-5 w-5",
                    photo.isFavorite && "fill-primary text-primary",
                  )}
                />
              </button>
            )}
            {showAlbumMove && (
              <AlbumMoveDropdown
                photoId={photo.id}
                currentAlbumId={photo.albumId}
              />
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
          {/* Left backdrop — click prev */}
          <div
            onClick={handlePrev}
            className="flex cursor-pointer items-center justify-start pl-1 sm:pl-2"
            style={{ flex: "1 1 0" }}
          >
            <button
              className="rounded-full bg-black/40 p-1.5 text-white/80 transition-colors hover:bg-black/60 hover:text-white sm:p-2"
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
            </button>
          </div>

          {/* Media container */}
          <div className="flex shrink-0 items-center justify-center" style={{ maxWidth: "85%" }}>
            {photo.isVideo ? (
              <video
                ref={videoRef}
                src={photo.url}
                controls
                className="max-h-full max-w-full rounded-lg"
                autoPlay
                onPlay={() => dispatchBgEvent("pause")}
                onPause={() => dispatchBgEvent("resume")}
                onEnded={() => dispatchBgEvent("resume")}
              />
            ) : isImage ? (
              <div className="relative flex max-h-[80vh] max-w-full items-center justify-center">
                {!loaded && (
                  <div className="absolute h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}
                <Image
                  src={photo.url}
                  alt={photo.caption ?? "Photo"}
                  width={photo.width || 1200}
                  height={photo.height || 800}
                  onLoad={() => setLoaded(true)}
                  unoptimized
                  placeholder={blurDataUrl ? "blur" : "empty"}
                  blurDataURL={blurDataUrl}
                  className={cn(
                    "max-h-[80vh] w-auto rounded-lg object-contain transition-opacity duration-300",
                    loaded ? "opacity-100" : "opacity-0",
                  )}
                  style={{ maxWidth: "100%", height: "auto" }}
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

          {/* Right backdrop — click next */}
          <div
            onClick={handleNext}
            className="flex cursor-pointer items-center justify-end pr-1 sm:pr-2"
            style={{ flex: "1 1 0" }}
          >
            <button
              className="rounded-full bg-black/40 p-1.5 text-white/80 transition-colors hover:bg-black/60 hover:text-white sm:p-2"
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
            </button>
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
                  {photo.width} × {photo.height}
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
