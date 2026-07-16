"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import Image from "next/image";
import { File, Heart, Play, Lock, CheckCircle, Globe, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { getOptimizedImageUrl, getBlurImageUrl, getVideoPosterUrl } from "@/lib/cloudinary-urls";
import type { Photo } from "@/types";

type PhotoCardProps = {
  photo: Photo;
  onFavoriteToggle?: (id: string, isFavorite: boolean) => void;
  onPublicToggle?: (id: string, isPublic: boolean) => void;
  onClick?: (photo: Photo) => void;
  isPrioritized?: boolean;
  selectable?: boolean;
  isSelected?: boolean;
  onSelectToggle?: (id: string) => void;
};

export default function PhotoCard({
  photo,
  onFavoriteToggle,
  onPublicToggle,
  onClick,
  isPrioritized,
  selectable,
  isSelected,
  onSelectToggle,
}: PhotoCardProps) {
  const [loaded, setLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [useOriginal, setUseOriginal] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // If the image is already loaded from cache by the time React attaches the
  // ref (so onLoad never fires), reveal it immediately to avoid being stuck
  // on the lazy-loading placeholder.
  const handleImgRef = useCallback((node: HTMLImageElement | null) => {
    imgRef.current = node;
    if (node && node.complete && node.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

  const aspectRatio = photo.width && photo.height ? photo.width / photo.height : 3 / 4;
  const rawDisplayUrl = useMemo(() => {
    if (photo.isVideo) {
      return photo.thumbnailUrl || getVideoPosterUrl(photo.url, 600);
    }
    return useOriginal || !photo.thumbnailUrl ? photo.url : photo.thumbnailUrl;
  }, [photo.isVideo, photo.url, photo.thumbnailUrl, useOriginal]);
  const displayUrl = useMemo(() => {
    if (!rawDisplayUrl) return "";
    try {
      return getOptimizedImageUrl(rawDisplayUrl, 600, { crop: "limit" });
    } catch {
      return rawDisplayUrl;
    }
  }, [rawDisplayUrl]);
  const canPreviewAsImage =
    photo.url.includes("/image/upload/") ||
    photo.thumbnailUrl?.includes("/image/upload/") ||
    rawDisplayUrl.includes("/image/upload/") ||
    photo.isVideo;

  useEffect(() => {
    setLoaded(false);
    setImgError(false);
    setUseOriginal(false);
  }, [photo.id, photo.thumbnailUrl, photo.url]);

  const blurDataUrl = useMemo(() => {
    if (!displayUrl) return undefined;
    try {
      return getBlurImageUrl(displayUrl);
    } catch {
      return undefined;
    }
  }, [displayUrl]);

  function handleClick() {
    if (selectable) {
      onSelectToggle?.(photo.id);
    } else {
      onClick?.(photo);
    }
  }

  return (
    <div
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-2xl bg-muted shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-lg",
        isSelected && "ring-2 ring-primary ring-offset-2",
      )}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleClick();
      }}
      role="button"
      tabIndex={0}
    >
      {!loaded && !imgError && (
        <div className="absolute inset-0 animate-pulse bg-muted" />
      )}

      {!canPreviewAsImage ? (
        <div className="flex aspect-[3/4] flex-col items-center justify-center gap-2 bg-muted px-4 text-center">
          <File className="h-8 w-8 text-muted-foreground/60" />
          <span className="line-clamp-2 text-xs font-medium text-muted-foreground">
            {photo.caption || photo.publicId.split("/").pop() || "File"}
          </span>
        </div>
      ) : imgError ? (
        <div className="flex aspect-[3/4] items-center justify-center bg-muted">
          <Lock className="h-8 w-8 text-muted-foreground/50" />
        </div>
      ) : (
        <div className="relative overflow-hidden" style={{ aspectRatio }}>
          <Image
            src={displayUrl}
            alt={photo.caption ?? "Photo"}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            priority={isPrioritized}
            loading={isPrioritized ? "eager" : "lazy"}
            ref={handleImgRef}
            onLoad={() => setLoaded(true)}
            onError={() => {
              if (!useOriginal && photo.thumbnailUrl) {
                setUseOriginal(true);
                setLoaded(false);
                return;
              }
              setImgError(true);
            }}
            placeholder={blurDataUrl ? "blur" : "empty"}
            blurDataURL={blurDataUrl}
            className={cn(
              "object-cover transition-all duration-500 group-hover:scale-105",
              loaded ? "opacity-100" : "opacity-0",
            )}
          />
        </div>
      )}

      {selectable && (
        <div
          className={cn(
            "absolute top-3 left-3 z-10 rounded-full p-1 backdrop-blur-sm transition-all duration-200",
            isSelected
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20 ring-2 ring-primary/30"
              : "bg-black/40 text-white/80 hover:bg-black/60 hover:text-white hover:scale-110",
          )}
        >
          <CheckCircle className={cn("h-5 w-5", isSelected && "fill-current")} />
        </div>
      )}

      {photo.isVideo && !selectable && (
        <div className="absolute top-3 left-3 rounded-full bg-black/50 p-1.5">
          <Play className="h-3.5 w-3.5 fill-white text-white" />
        </div>
      )}

      <div
        className={cn(
          "absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/40 via-transparent to-transparent p-4 opacity-0 transition-opacity duration-300",
          "group-hover:opacity-100",
        )}
      >
        {photo.caption && (
          <p className="text-sm font-medium text-white drop-shadow-md">
            {photo.caption}
          </p>
        )}
      </div>

      {!selectable && (onPublicToggle || onFavoriteToggle) && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
          {onPublicToggle && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPublicToggle?.(photo.id, !photo.isPublic);
              }}
              className={cn(
                "rounded-full p-1.5 backdrop-blur-sm transition-all duration-200",
                photo.isPublic
                  ? "bg-black/30 text-white/70 hover:bg-black/50 hover:text-white hover:scale-110"
                  : "bg-primary text-primary-foreground shadow-sm shadow-primary/20",
              )}
              aria-label={photo.isPublic ? "Jadikan privat" : "Jadikan publik"}
              title={photo.isPublic ? "Publik" : "Privat"}
            >
              {photo.isPublic ? (
                <Globe className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </button>
          )}
          {onFavoriteToggle && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFavoriteToggle?.(photo.id, !photo.isFavorite);
              }}
              className={cn(
                "rounded-full p-1.5 backdrop-blur-sm transition-all duration-200",
                photo.isFavorite
                  ? "bg-primary/25 text-primary shadow-sm shadow-primary/10"
                  : "bg-black/30 text-white/70 hover:bg-black/50 hover:text-white hover:scale-110",
              )}
              aria-label={photo.isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Heart
                className={cn(
                  "h-4 w-4 transition-transform",
                  photo.isFavorite && "fill-primary scale-110",
                )}
                style={photo.isFavorite ? { animation: "heartBeat 0.4s ease-out" } : undefined}
              />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
