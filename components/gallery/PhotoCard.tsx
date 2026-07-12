"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { Heart, Play, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBlurImageUrl } from "@/lib/cloudinary-urls";
import type { Photo } from "@/types";

type PhotoCardProps = {
  photo: Photo;
  onFavoriteToggle?: (id: string, isFavorite: boolean) => void;
  onClick?: (photo: Photo) => void;
  isPrioritized?: boolean;
};

export default function PhotoCard({
  photo,
  onFavoriteToggle,
  onClick,
  isPrioritized,
}: PhotoCardProps) {
  const [loaded, setLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const aspectRatio = photo.width && photo.height ? photo.width / photo.height : 3 / 4;

  const blurDataUrl = useMemo(() => {
    const imgUrl = photo.thumbnailUrl || photo.url;
    if (!imgUrl) return undefined;
    try {
      return getBlurImageUrl(imgUrl);
    } catch {
      return undefined;
    }
  }, [photo.thumbnailUrl, photo.url]);

  return (
    <div
      className="group relative cursor-pointer overflow-hidden rounded-2xl bg-muted shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
      onClick={() => onClick?.(photo)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onClick?.(photo);
      }}
      role="button"
      tabIndex={0}
    >
      {!loaded && !imgError && (
        <div className="absolute inset-0 animate-pulse bg-muted" />
      )}

      {imgError ? (
        <div className="flex aspect-[3/4] items-center justify-center bg-muted">
          <Lock className="h-8 w-8 text-muted-foreground/50" />
        </div>
      ) : (
        <div className="relative overflow-hidden" style={{ aspectRatio }}>
          <Image
            src={photo.thumbnailUrl || photo.url}
            alt={photo.caption ?? "Photo"}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            priority={isPrioritized}
            loading={isPrioritized ? "eager" : "lazy"}
            onLoad={() => setLoaded(true)}
            onError={() => setImgError(true)}
            placeholder={blurDataUrl ? "blur" : "empty"}
            blurDataURL={blurDataUrl}
            className={cn(
              "object-cover transition-all duration-500 group-hover:scale-105",
              loaded ? "opacity-100" : "opacity-0",
            )}
          />
        </div>
      )}

      {photo.isVideo && (
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

      <button
        onClick={(e) => {
          e.stopPropagation();
          onFavoriteToggle?.(photo.id, !photo.isFavorite);
        }}
        className={cn(
          "absolute top-3 right-3 rounded-full p-1.5 transition-all",
          photo.isFavorite
            ? "bg-primary/20 text-primary"
            : "bg-black/20 text-white opacity-0 group-hover:opacity-100",
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
    </div>
  );
}
