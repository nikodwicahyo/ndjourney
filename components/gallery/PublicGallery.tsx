"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useQueryClient } from "@tanstack/react-query";
import { usePhotos, photoKeys } from "@/hooks/usePhotos";
import MasonryGrid from "./MasonryGrid";
import AlbumSelector from "./AlbumSelector";
import type { Photo } from "@/types";
import { toast } from "sonner";

const Lightbox = dynamic(() => import("./Lightbox"), {
  ssr: false,
});

type Filters = {
  albumId?: string;
  year?: number;
  isFavorite?: boolean;
  mediaType?: string;
  sort?: string;
};

export default function PublicGallery() {
  const [filters, setFilters] = useState<Filters>({});
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [lightboxPhotos, setLightboxPhotos] = useState<Photo[]>([]);

  const { data, fetchNextPage, hasNextPage } = usePhotos({ ...filters, isPublic: true });
  const queryClient = useQueryClient();
  const isLoadingAllRef = useRef(false);

  const allPhotos = useMemo(
    () => (data?.pages.flatMap((p) => p.data ?? []) ?? []).filter(Boolean) as Photo[],
    [data],
  );

  const counts = useMemo(() => ({
    all: data?.pages[0]?.total ?? allPhotos.length,
    foto: data?.pages[0]?.fotoTotal ?? allPhotos.filter((p) => !p.isVideo).length,
    video: data?.pages[0]?.videoTotal ?? allPhotos.filter((p) => p.isVideo).length,
  }), [data, allPhotos]);

  const handlePhotoClick = useCallback(
    async (photos: Photo[], index: number) => {
      if (isLoadingAllRef.current) return;
      if (hasNextPage) {
        isLoadingAllRef.current = true;
        const toastId = toast.loading("Memuat semua media...");
        let more = true;
        let pageCount = 0;
        while (more && pageCount < 20) {
          const result = await fetchNextPage();
          const pages = (result as any)?.data?.pages ?? [];
          const lastPage = pages[pages.length - 1];
          more = lastPage?.hasMore ?? false;
          pageCount++;
        }
        toast.dismiss(toastId);
        isLoadingAllRef.current = false;
      }
      const allData = queryClient.getQueryData(photoKeys.list({ ...filters, isPublic: true }));
      const allPhotos = ((allData as any)?.pages ?? []).flatMap((p: any) => p.data ?? []) as Photo[];
      setLightboxPhotos(allPhotos.length > 0 ? allPhotos : photos);
      setLightboxIndex(index);
    },
    [hasNextPage, fetchNextPage, queryClient, filters],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl">Gallery</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Semua kenangan kita
          </p>
        </div>
      </div>

      <AlbumSelector filters={filters} onFiltersChange={setFilters} isPublic counts={counts} />

      <div className="relative">
        <MasonryGrid
          filters={filters}
          onPhotoClick={(photo, index, allPhotos) => handlePhotoClick(allPhotos, index)}
          isPublic
        />
      </div>

      <Lightbox
        photos={lightboxPhotos}
        currentIndex={lightboxIndex}
        isOpen={lightboxIndex >= 0}
        onClose={() => setLightboxIndex(-1)}
        onNavigate={setLightboxIndex}
        showAlbumMove={false}
        fetchNextPage={fetchNextPage}
        hasNextPage={hasNextPage}
      />
    </div>
  );
}
