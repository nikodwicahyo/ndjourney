"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePhotos } from "@/hooks/usePhotos";
import PhotoCard from "./PhotoCard";
import { Button } from "@/components/ui";
import { cn, GALLERY_GRID_CLASSES, GALLERY_TILE_CLASSES } from "@/lib/utils";
import { ImageIcon } from "lucide-react";
import type { Photo } from "@/types";

type MasonryGridProps = {
  filters?: {
    albumId?: string;
    year?: number;
    isFavorite?: boolean;
    mediaType?: string;
    sort?: string;
  };
  onPhotoClick?: (photo: Photo, index: number, allPhotos: Photo[], fetchNextPage?: () => void, hasNextPage?: boolean) => void;
  visibility?: "public" | "private";
};

function PhotoSkeleton() {
  return (
    <div className={cn(GALLERY_TILE_CLASSES, "rounded-2xl bg-muted motion-safe:animate-pulse")} />
  );
}

export default function MasonryGrid({ filters, onPhotoClick, visibility }: MasonryGridProps) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = usePhotos({ ...filters, visibility });

  const loadMoreRef = useRef<HTMLDivElement>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(handleObserver, {
      rootMargin: "200px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleObserver]);

  // The API already returns them in the requested order (createdAt, id).
  // Rendered as-is: CSS grid reads left→right then the next row, so DOM order
  // is the reading order with nothing to transpose.
  const allPhotos = (data?.pages.flatMap((page) => page.data ?? []) ?? []).filter(Boolean) as Photo[];

  // stable handler so memo(PhotoCard) actually skips re-renders.
  const handlePhotoClick = useCallback(
    (photo: Photo) => {
      const origIndex = allPhotos.indexOf(photo);
      onPhotoClick?.(photo, origIndex, allPhotos, fetchNextPage, !!hasNextPage);
    },
    [allPhotos, onPhotoClick, fetchNextPage, hasNextPage],
  );

  if (isLoading) {
    return (
      <div className={GALLERY_GRID_CLASSES}>
        {Array.from({ length: 8 }).map((_, i) => (
          <PhotoSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <p role="alert" className="text-destructive">Gagal memuat media</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Coba Lagi
        </Button>
      </div>
    );
  }

  if (allPhotos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <ImageIcon className="h-12 w-12 text-muted-foreground" />
        <div>
          <p className="font-medium">Belum ada media</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload media pertama untuk memulai galeri.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={GALLERY_GRID_CLASSES}>
        {allPhotos.map((photo, index) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            onClick={handlePhotoClick}
            isPrioritized={index < 8}
          />
        ))}
      </div>

      <div ref={loadMoreRef} className="py-8">
        {isFetchingNextPage && (
          <div className={GALLERY_GRID_CLASSES}>
            {Array.from({ length: 4 }).map((_, i) => (
              <PhotoSkeleton key={i} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
