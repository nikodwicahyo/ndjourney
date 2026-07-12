"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { useUploadPhoto } from "@/hooks/usePhotos";
import MasonryGrid from "./MasonryGrid";
import UploadButton from "./UploadButton";
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

export default function GalleryClient() {
  const { data: session } = useSession();
  const uploadPhoto = useUploadPhoto();
  const [filters, setFilters] = useState<Filters>({});
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [lightboxPhotos, setLightboxPhotos] = useState<Photo[]>([]);

  const handleUpload = useCallback(
    async (file: File) => {
      try {
        await uploadPhoto.mutateAsync({ file });
        const l = file.type.startsWith("video/") ? "Video" : "Foto";
        toast.success(`${l} berhasil diupload! 💕`);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Gagal upload media",
        );
      }
    },
    [uploadPhoto],
  );

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
        {session?.user && <UploadButton onUpload={handleUpload} />}
      </div>

      <AlbumSelector filters={filters} onFiltersChange={setFilters} />

      <MasonryGrid
        filters={filters}
        onPhotoClick={(photo, index, allPhotos) => handlePhotoClick(allPhotos, index)}
      />

      <Lightbox
        photos={lightboxPhotos}
        currentIndex={lightboxIndex}
        isOpen={lightboxIndex >= 0}
        onClose={() => setLightboxIndex(-1)}
        onNavigate={setLightboxIndex}
        showAlbumMove={true}
      />
    </div>
  );
}
