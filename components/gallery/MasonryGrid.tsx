"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePhotos, useUpdatePhoto } from "@/hooks/usePhotos";
import PhotoCard from "./PhotoCard";
import { Button } from "@/components/ui";
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
  onPhotoClick?: (photo: Photo, index: number, allPhotos: Photo[]) => void;
  isPublic?: boolean;
};

function PhotoSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl">
      <div className="aspect-[3/4] w-full animate-pulse bg-muted" />
    </div>
  );
}

export default function MasonryGrid({ filters, onPhotoClick, isPublic }: MasonryGridProps) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = usePhotos({ ...filters, isPublic });

  const updatePhoto = useUpdatePhoto();
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

  const allPhotos = (data?.pages.flatMap((page) => page.data ?? []) ?? []).filter(Boolean) as Photo[];

  if (isLoading) {
    return (
      <div className="columns-2 gap-3 md:columns-3 lg:columns-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <PhotoSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-destructive">Gagal memuat media</p>
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
      <div className="columns-2 gap-3 md:columns-3 lg:columns-4">
        {allPhotos.map((photo, index) => (
          <div key={photo.id} className="mb-3 break-inside-avoid">
            <PhotoCard
              photo={photo}
              onClick={(p) => onPhotoClick?.(p, index, allPhotos)}
              onFavoriteToggle={(id, isFavorite) =>
                updatePhoto.mutate({ id, isFavorite })
              }
              isPrioritized={index < 8}
            />
          </div>
        ))}
      </div>

      <div ref={loadMoreRef} className="py-8">
        {isFetchingNextPage && (
          <div className="columns-2 gap-3 md:columns-3 lg:columns-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <PhotoSkeleton key={i} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
