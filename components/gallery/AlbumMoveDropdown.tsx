"use client";

import { useState } from "react";
import { useAlbums, useUpdatePhoto } from "@/hooks/usePhotos";
import { Folder, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type AlbumMoveDropdownProps = {
  photoId: string;
  currentAlbumId?: string | null;
};

export default function AlbumMoveDropdown({
  photoId,
  currentAlbumId,
}: AlbumMoveDropdownProps) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(currentAlbumId ?? null);
  const { data: albums, isLoading } = useAlbums();
  const updatePhoto = useUpdatePhoto();

  async function handleMove() {
    if (selectedId === currentAlbumId) {
      setOpen(false);
      return;
    }
    try {
      await updatePhoto.mutateAsync({ id: photoId, albumId: selectedId });
      toast.success("Media dipindahkan 📁");
      setOpen(false);
    } catch {
      toast.error("Gagal memindahkan media");
    }
  }

  function handleOpen() {
    setSelectedId(currentAlbumId ?? null);
    setOpen(true);
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/10"
        aria-label="Pindahkan ke album"
      >
        <Folder className="h-5 w-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold">Pindahkan ke Album</h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-1 transition-colors hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-64 space-y-1.5 overflow-y-auto">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                  selectedId === null
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-accent",
                )}
              >
                {selectedId === null ? (
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <div className="h-4 w-4 shrink-0" />
                )}
                Tanpa album
              </button>

              {isLoading ? (
                <div className="flex items-center justify-center py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                albums?.map((album) => (
                  <button
                    key={album.id}
                    type="button"
                    onClick={() => setSelectedId(album.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                      selectedId === album.id
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-accent",
                    )}
                  >
                    {selectedId === album.id ? (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <div className="h-4 w-4 shrink-0" />
                    )}
                    <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate">{album.name}</span>
                      {album.description && (
                        <span className="block truncate text-[10px] font-normal text-muted-foreground">
                          {album.description}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground/60">
                      {album._count.photos} file
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="mt-5 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setOpen(false)}
              >
                Batal
              </Button>
              <Button
                className="flex-1 gap-1.5"
                onClick={handleMove}
                disabled={selectedId === currentAlbumId || updatePhoto.isPending}
              >
                {updatePhoto.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Folder className="h-4 w-4" />
                )}
                Pindahkan
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Button({
  children,
  className,
  disabled,
  onClick,
  variant,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  variant?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors",
        variant === "outline"
          ? "border border-border bg-background text-foreground hover:bg-accent"
          : "bg-primary text-primary-foreground hover:bg-primary/90",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}
