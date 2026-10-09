"use client";

/* eslint-disable @next/next/no-img-element -- custom Cloudinary srcset plus transform anchored zoom; next/image wrappers break zoom math and hosts vary */

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
  RefreshCw,
  Info,
  Calendar,
  User,
  Ruler,
  HardDrive,
} from "lucide-react";
import { cn, formatDate, formatBytes } from "@/lib/utils";
import {
  getOptimizedImageUrl,
  getImageSrcSet,
  getOptimizedVideoUrl,
  getBlurImageUrl,
} from "@/lib/cloudinary-urls";
import type { PhotoWithUploader } from "@/types";
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
  photos: PhotoWithUploader[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onFavoriteToggle?: (id: string, isFavorite: boolean) => void;
  onDelete?: (id: string) => void;
  showAlbumMove?: boolean;
  // Download is an authenticated-only capability (same prop-driven pattern
  // as favorite/delete/album-move). Secure default: hidden unless opted in.
  showDownload?: boolean;
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
  showDownload = false,
  fetchNextPage,
  hasNextPage,
  totalCount,
}: LightboxProps) {
  const [mediaState, setMediaState] = useState<MediaState>("loading");
  const [retryKey, setRetryKey] = useState(0);
  const MAX_ZOOM = 8;
  // Controlled zoom view: scale + translate in STABLE container coords.
  // The media box never transforms, so its rect is always a valid anchor
  // frame however deep the layout nests (no measuring transformed boxes).
  const [view, setView] = useState({ s: 1, tx: 0, ty: 0 });
  const isZoomed = view.s > 1;
  // ref mirror for gesture handlers (no stale closures, no re-subscribe).
  const viewRef = useRef(view);
  viewRef.current = view;
  // Swipe-to-navigate (single pointer at 1x): the slide follows the finger,
  // releasing past SWIPE_PX flips it. Nav buttons share the same 1x gate
  // (auto-hidden while zoomed).
  const SWIPE_PX = 60;
  const [dragX, setDragX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const swipeRef = useRef<{ x0: number; y0: number; active: boolean } | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [direction, setDirection] = useState(1);
  const photo = photos[currentIndex];
  const videoRef = useRef<HTMLVideoElement>(null);
  const isVideoRef = useRef(false);
  // F-13: keyboard users land inside the viewer on open and return on close.
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<Element | null>(null);
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
    // one swap when crossing into zoom (not per tick) — deep zoom
    // gets headroom without reload storms mid-gesture.
    const cap = isZoomed ? 3200 : 1600;
    const clamped = Math.max(640, Math.min(target, cap));
    return Math.min(photo.width, clamped);
  }, [photo?.width, isZoomed]);

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

  // Gesture refs + resetView live above the nav handlers: the handlers list
  // resetView in their dep arrays (evaluated during render), so it must be
  // initialized before them — not just called later.
  // One gesture system for mouse + touch — tracked pointers drive
  // pan (1 pointer, zoomed) and pinch-zoom (2 pointers); a clean tap toggles.
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef<{ pinchDist: number; scale: number; tx: number; ty: number } | null>(null);
  const tapRef = useRef<{ x: number; y: number; t: number } | null>(null);

  const resetView = useCallback(() => {
    pointersRef.current.clear();
    gestureRef.current = null;
    tapRef.current = null;
    swipeRef.current = null;
    setPanning(false);
    setSwiping(false);
    setDragX(0);
    setView({ s: 1, tx: 0, ty: 0 });
  }, []);

  const handlePrev = useCallback(() => {
    if (isVideoRef.current) dispatchBgEvent("resume");
    if (currentIndex === 0) return;
    setDirection(-1);
      resetView();
    onNavigate(currentIndex - 1);
  }, [currentIndex, onNavigate, resetView]);

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
            resetView();
            onNavigate(currentIndex + 1);
          }
        } finally {
          isFetchingRef.current = false;
        }
      }
      return;
    }
      resetView();
    onNavigate(currentIndex + 1);
  }, [currentIndex, photos.length, onNavigate, hasNextPage, fetchNextPage, resetView]);

  const handleClose = useCallback(() => {
    if (isVideoRef.current) dispatchBgEvent("resume");
      resetView();
    // F-13: return focus to the originating thumbnail on close.
    (restoreFocusRef.current as HTMLElement | null)?.focus?.();
    restoreFocusRef.current = null;
    onClose();
  }, [onClose, resetView]);

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

  // Zoom to `newScale` keeping the content point under (clientX, clientY)
  // exactly where it is. Snap back to center when landing on 1x.
  const mediaBoxRef = useRef<HTMLDivElement>(null);

  const clampScale = (s: number) =>
    Math.min(MAX_ZOOM, Math.max(1, Math.round(s * 100) / 100));

  // Zoom to `newScale`. Default keeps the content point under
  // (clientX, clientY) exactly where it is; with `toCenter`, that point
  // glides to the middle of the screen instead. Snap back to center on 1x.
  const zoomAt = useCallback((clientX: number, clientY: number, newScale: number, toCenter = false) => {
    const box = mediaBoxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const v = viewRef.current;
    const s = clampScale(newScale);
    const k = s / v.s;
    const ax = toCenter ? rect.width / 2 : px;
    const ay = toCenter ? rect.height / 2 : py;
    let tx = ax - (px - v.tx) * k;
    let ty = ay - (py - v.ty) * k;
    if (s <= 1) {
      tx = 0;
      ty = 0;
    }
    setView({ s, tx: Math.round(tx), ty: Math.round(ty) });
  }, []);

  // one gesture system for mouse + touch — tracked pointers drive
  // pan (1 pointer, zoomed) and pinch-zoom (2 pointers); a clean tap toggles.
  // (Refs + resetView live above the nav handlers; see note there.)
  const [panning, setPanning] = useState(false);
  const TAP_PX = 8;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      // Video controls own the <video> surface — swipe starts from the
      // stage around it, never from the frame itself (a horizontal
      // seek-drag would otherwise flip the gallery past SWIPE_PX).
      if ((e.target as HTMLElement).closest?.("video")) return;
      try {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      } catch {
        // ignore capture failures (stale target)
      }
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointersRef.current.size === 2) {
        if (photo?.isVideo) {
          // No pinch-zoom on video (nothing renders the transform — it
          // would only hide the nav arrows via isZoomed). Cancel swipe.
          swipeRef.current = null;
          setSwiping(false);
          setDragX(0);
          tapRef.current = null;
          setPanning(false);
          return;
        }
        // Second finger = pinch intent, not a swipe.
        swipeRef.current = null;
        setSwiping(false);
        setDragX(0);
        const [a, b] = [...pointersRef.current.values()];
        const v = viewRef.current;
        gestureRef.current = {
          pinchDist: Math.hypot(a.x - b.x, a.y - b.y),
          scale: v.s,
          tx: v.tx,
          ty: v.ty,
        };
        tapRef.current = null;
        setPanning(false);
      } else if (pointersRef.current.size === 1) {
        tapRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
        if (viewRef.current.s > 1) setPanning(true);
        swipeRef.current =
          viewRef.current.s === 1 ? { x0: e.clientX, y0: e.clientY, active: false } : null;
      }
    },
    [photo?.isVideo],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const pts = pointersRef.current;
    const prev = pts.get(e.pointerId);
    if (!prev) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (tapRef.current) {
      if (Math.hypot(e.clientX - tapRef.current.x, e.clientY - tapRef.current.y) > TAP_PX) {
        tapRef.current = null;
      }
    }
    if (pts.size === 2) {
      const g = gestureRef.current;
      if (!g) return;
      const [a, b] = [...pts.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist <= 0 || g.pinchDist <= 0) return;
      const box = mediaBoxRef.current?.getBoundingClientRect();
      const px = (a.x + b.x) / 2 - (box?.left ?? 0);
      const py = (a.y + b.y) / 2 - (box?.top ?? 0);
      const s = clampScale(g.scale * (dist / g.pinchDist));
      const k = s / g.scale;
      let tx = px - (px - g.tx) * k;
      let ty = py - (py - g.ty) * k;
      if (s <= 1) {
        tx = 0;
        ty = 0;
      }
      setView({ s, tx: Math.round(tx), ty: Math.round(ty) });
    } else if (pts.size === 1) {
      const v = viewRef.current;
      if (v.s > 1) {
        setView({ s: v.s, tx: Math.round(v.tx + (e.clientX - prev.x)), ty: Math.round(v.ty + (e.clientY - prev.y)) });
      } else {
        const sw = swipeRef.current;
        if (sw && !sw.active) {
          const dx = e.clientX - sw.x0;
          const dy = e.clientY - sw.y0;
          if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) sw.active = true;
          else if (Math.abs(dy) > 12) swipeRef.current = null; // vertical intent: not ours
        }
        if (swipeRef.current?.active) {
          setSwiping(true);
          setDragX(e.clientX - swipeRef.current.x0);
        }
      }
    }
  }, []);

  const endPointer = useCallback(
    (e: React.PointerEvent) => {
      pointersRef.current.delete(e.pointerId);
      if (pointersRef.current.size < 2) gestureRef.current = null;
      if (pointersRef.current.size === 0) {
        setPanning(false);
        const sw = swipeRef.current;
        swipeRef.current = null;
        if (sw?.active) {
          setSwiping(false);
          const dx = e.clientX - sw.x0;
          setDragX(0);
          if (e.type !== "pointercancel") {
            if (dx <= -SWIPE_PX) handleNext();
            else if (dx >= SWIPE_PX) handlePrev();
          }
        }
        const tap = tapRef.current;
        tapRef.current = null;
        // Clean tap on the photo toggles a quick 2x peek centered on the
        // tap point (wheel/pinch stay anchored instead).
        if (tap && Date.now() - tap.t < 500 && (e.target as HTMLElement).closest("img")) {
          if (viewRef.current.s > 1) {
            resetView();
          } else {
            zoomAt(e.clientX, e.clientY, 2, true);
          }
        }
      }
    },
    [zoomAt, resetView, handlePrev, handleNext],
  );

  // Desktop (and mobile) wheel: plain = coarse step, ctrlKey (trackpad
  // pinch) = fine step. Non-passive so the page never scrolls mid-zoom.
  useEffect(() => {
    const el = mediaBoxRef.current;
    if (!el || photo?.isVideo) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const step = e.ctrlKey ? 0.25 : 0.5;
      const v = viewRef.current;
      zoomAt(e.clientX, e.clientY, v.s + (e.deltaY < 0 ? step : -step));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [photo?.isVideo, zoomAt]);

  useEffect(() => {
    isVideoRef.current = photo?.isVideo ?? false;
  }, [photo]);

  useEffect(() => {
    setMediaState("loading");
    resetView();
    setShowInfo(false);
  }, [photo?.id, resetView]);

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
    if (isOpen) {
      restoreFocusRef.current = document.activeElement;
      // Next frame so AnimatePresence has mounted the node.
      const t = window.setTimeout(() => dialogRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          if (isZoomed) {
            resetView();
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
  }, [isOpen, handleClose, handlePrev, handleNext, isZoomed, resetView]);

  if (!isOpen || !photo) return null;

  const isImage = photo.url.includes("/image/upload/");
  const fileName = photo.caption || photo.publicId.split("/").pop() || "File";

  return (
    <AnimatePresence>
      <motion.div
        key="lightbox-overlay"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={fileName}
        tabIndex={-1}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 bg-black/95 outline-none"
      >
        <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-8">
          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Tutup"
            >
              <X className="h-5 w-5" />
            </button>
            <span className="text-sm text-white/60">
              {currentIndex + 1} / {totalCount ?? photos.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {!photo.isVideo && (
              <span className="w-12 text-center text-xs tabular-nums text-white/80">
                {Math.round(view.s * 100)}%
              </span>
            )}
            {onFavoriteToggle && (
              <button
                onClick={() => onFavoriteToggle(photo.id, !photo.isFavorite)}
                className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/10"
                aria-label={photo.isFavorite ? "Hapus dari favorit" : "Tambah ke favorit"}
              >
                <Heart
                  className={cn("h-5 w-5", photo.isFavorite && "fill-primary text-primary")}
                />
              </button>
            )}
            {showAlbumMove && (
              <AlbumMoveDropdown photoId={photo.id} currentAlbumId={photo.albumId} />
            )}
            {showDownload && (
              <button
                onClick={handleDownload}
                className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/10"
                aria-label="Unduh"
              >
                <Download className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={() => setShowInfo(!showInfo)}
              className={cn(
                "rounded-full p-2 transition-colors",
                showInfo ? "text-white bg-white/20" : "text-white/80 hover:bg-white/10"
              )}
              aria-label="Detail"
            >
              <Info className="h-5 w-5" />
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

        {/* Full-viewport media stage — nav + bars float above it so portrait
            media can use the entire screen. */}
        <div
          ref={mediaBoxRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          className="absolute inset-0 grid place-items-center overflow-hidden"
          style={{
            // fully locked — no scroll, no browser gestures;
            // zoom is transform-anchored so there is nothing to drag.
            touchAction: "none",
          }}
        >
            <AnimatePresence initial={false} custom={direction}>
              <motion.div
                key={photo.isVideo ? `v-${photo.id}` : `i-${photo.id}`}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate={{ x: dragX }}
                exit="exit"
                transition={{ x: { duration: swiping ? 0 : 0.35, ease: [0.4, 0, 0.2, 1] } }}
                className="absolute inset-0 flex items-center justify-center"
                style={{ willChange: "transform" }}
              >
                {photo.isVideo ? (
                  <video
                    ref={videoRef}
                    src={getOptimizedVideoUrl(photo.url)}
                    controls
                    preload="metadata"
                    poster={getVideoPosterUrl(photo.url)}
                    className="max-h-full w-auto max-w-full rounded-lg object-contain"
                    autoPlay
                    onPlay={() => dispatchBgEvent("pause")}
                    onPause={() => dispatchBgEvent("resume")}
                    onEnded={() => dispatchBgEvent("resume")}
                  />
                ) : isImage ? (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                      transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.s})`,
                      transformOrigin: "0 0",
                    }}
                  >
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
                        src={mediaState === "loaded" ? optimizedUrl : blurPlaceholderUrl}
                        alt={photo.caption ?? "Photo"}
                        draggable={false}
                        srcSet={mediaState === "loaded" ? srcSet : undefined}
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 80vw"
                        decoding="async"
                        fetchPriority={mediaState === "loading" ? "low" : "high"}
                        className={cn(
                          "max-h-full w-auto max-w-full rounded-lg object-contain transition-opacity duration-500 select-none",
                          mediaState === "loading" ? "opacity-40" : "opacity-100",
                          !isZoomed
                            ? "cursor-zoom-in"
                            : panning
                              ? "cursor-grabbing"
                              : "cursor-grab",
                        )}
                        style={{ maxWidth: "100%", height: "auto" }}
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

        {!isZoomed && (
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="absolute left-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/40 p-2.5 text-white/80 transition-colors hover:bg-black/60 hover:text-white disabled:opacity-30 disabled:hover:bg-black/40 disabled:hover:text-white/80 sm:p-3"
            aria-label="Sebelumnya"
          >
            <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
          </button>
        )}
        {!isZoomed && (
          <button
            onClick={handleNext}
            disabled={currentIndex >= photos.length - 1 && !hasNextPage}
            className="absolute right-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/40 p-2.5 text-white/80 transition-colors hover:bg-black/60 hover:text-white disabled:opacity-30 disabled:hover:bg-black/40 disabled:hover:text-white/80 sm:p-3"
            aria-label="Berikutnya"
          >
            <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
          </button>
        )}

        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-6 pt-8 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              {photo.caption && (
                <p className="text-sm text-white/90 truncate">{photo.caption}</p>
              )}
              <div className="mt-1 flex items-center gap-3 text-xs text-white/50">
                <span>{formatDate(photo.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>

        {showInfo && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowInfo(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between border-b border-border pb-4">
                <h2 className="font-heading text-lg font-semibold">Detail Media</h2>
                <button
                  onClick={() => setShowInfo(false)}
                  className="rounded-full p-1 transition-colors hover:bg-muted"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <User className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Diupload oleh</p>
                    <p className="text-sm font-medium truncate">
                      {photo.uploadedBy?.name || photo.uploadedByName || "Tidak diketahui"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Calendar className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tanggal upload</p>
                    <p className="text-sm font-medium">{formatDate(photo.createdAt)}</p>
                  </div>
                </div>

                {photo.width && photo.height && (
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Ruler className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Resolusi</p>
                      <p className="text-sm font-medium">{photo.width}x{photo.height}px</p>
                    </div>
                  </div>
                )}

                {photo.fileSize && (
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <HardDrive className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Ukuran file</p>
                      <p className="text-sm font-medium">{formatBytes(photo.fileSize)}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <File className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tipe</p>
                    <p className="text-sm font-medium">{photo.isVideo ? "Video" : "Foto"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export default memo(Lightbox);
