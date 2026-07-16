"use client";

import { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { useUploadPhoto, photoKeys } from "@/hooks/usePhotos";
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
  const fetchNextPageRef = useRef<(() => void) | undefined>(undefined);
  const hasNextPageRef = useRef(false);
  const isLoadingAllRef = useRef(false);

  const handleUpload = useCallback(
    async (file: File) => {
      try {
        await uploadPhoto.mutateAsync({ file, albumId: filters.albumId });
        const l = file.type.startsWith("video/") ? "Video" : "Foto";
        toast.success(`${l} berhasil diupload! 💕`);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Gagal upload media",
        );
      }
    },
    [uploadPhoto, filters.albumId],
  );

  const queryClient = useQueryClient();

  const handlePhotoClick = useCallback(
    async (photos: Photo[], index: number, fetchNextPage?: () => void, hasNextPage?: boolean) => {
      if (isLoadingAllRef.current) return;
      if (hasNextPage && fetchNextPage) {
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
      const allData = queryClient.getQueryData(photoKeys.list({ ...filters }));
      const allPhotos = ((allData as any)?.pages ?? []).flatMap((p: any) => p.data ?? []) as Photo[];
      setLightboxPhotos(allPhotos.length > 0 ? allPhotos : photos);
      setLightboxIndex(index);
      fetchNextPageRef.current = fetchNextPage;
      hasNextPageRef.current = !!hasNextPage;
    },
    [queryClient, filters],
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
        onPhotoClick={(photo, index, allPhotos, fetchNextPage, hasNextPage) => handlePhotoClick(allPhotos, index, fetchNextPage, hasNextPage)}
      />

      <Lightbox
        photos={lightboxPhotos}
        currentIndex={lightboxIndex}
        isOpen={lightboxIndex >= 0}
        onClose={() => setLightboxIndex(-1)}
        onNavigate={setLightboxIndex}
        showAlbumMove={true}
        fetchNextPage={fetchNextPageRef.current}
        hasNextPage={hasNextPageRef.current}
      />
    </div>
  );
}
