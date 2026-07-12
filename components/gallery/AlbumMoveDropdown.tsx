"use client";

import { useState } from "react";
import { useAlbums, useUpdatePhoto } from "@/hooks/usePhotos";
import { Folder, Loader2, Check, Plus } from "lucide-react";
import { toast } from "sonner";

type AlbumMoveDropdownProps = {
  photoId: string;
  currentAlbumId?: string | null;
};

export default function AlbumMoveDropdown({
  photoId,
  currentAlbumId,
}: AlbumMoveDropdownProps) {
  const [open, setOpen] = useState(false);
  const { data: albums, isLoading } = useAlbums();
  const updatePhoto = useUpdatePhoto();

  async function handleMove(albumId: string | null) {
    if (albumId === currentAlbumId) {
      setOpen(false);
      return;
    }
    try {
      await updatePhoto.mutateAsync({ id: photoId, albumId });
      toast.success("Media dipindahkan 📁");
      setOpen(false);
    } catch {
      toast.error("Gagal memindahkan media");
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/10"
        aria-label="Pindahkan ke album"
      >
        <Folder className="h-5 w-5" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-border bg-popover p-1 shadow-lg">
            <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Pindahkan ke album
            </p>

            <button
              onClick={() => handleMove(null)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent ${
                !currentAlbumId ? "text-primary" : "text-foreground"
              }`}
            >
              <Check className={`h-4 w-4 ${!currentAlbumId ? "opacity-100" : "opacity-0"}`} />
              Tidak ada album
            </button>

            {isLoading ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              albums?.map((album) => (
                <button
                  key={album.id}
                  onClick={() => handleMove(album.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent ${
                    album.id === currentAlbumId
                      ? "text-primary"
                      : "text-foreground"
                  }`}
                >
                  <Check
                    className={`h-4 w-4 ${
                      album.id === currentAlbumId ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1 text-left">{album.name}</span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
