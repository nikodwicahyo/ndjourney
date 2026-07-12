"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import MasonryGrid from "./MasonryGrid";
import AlbumSelector from "./AlbumSelector";
import type { Photo } from "@/types";

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

  const handlePhotoClick = useCallback(
    (photos: Photo[], index: number) => {
      setLightboxPhotos(photos);
      setLightboxIndex(index);
    },
    [],
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

      <AlbumSelector filters={filters} onFiltersChange={setFilters} isPublic />

      <MasonryGrid
        filters={filters}
        onPhotoClick={(photo, index, allPhotos) => handlePhotoClick(allPhotos, index)}
        isPublic
      />

      <Lightbox
        photos={lightboxPhotos}
        currentIndex={lightboxIndex}
        isOpen={lightboxIndex >= 0}
        onClose={() => setLightboxIndex(-1)}
        onNavigate={setLightboxIndex}
        showAlbumMove={false}
      />
    </div>
  );
}
