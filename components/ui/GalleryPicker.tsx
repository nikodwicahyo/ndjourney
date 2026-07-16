"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X, Loader2, ImageOff } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export type GalleryPickerPhoto = {
  id: string;
  url: string;
  thumbnailUrl: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (photo: GalleryPickerPhoto) => void;
  /** When true, multiple photos can stay selected (used for milestone photos). */
  multi?: boolean;
  /** IDs currently selected (for multi mode highlight). */
  selectedIds?: string[];
  title?: string;
};

const PAGE_SIZE = 60;

async function fetchPhotos(cursor: string | null): Promise<{
  data: GalleryPickerPhoto[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    mediaType: "foto",
    sort: "newest",
  });
  if (cursor) params.set("cursor", cursor);
  const res = await fetch(`/api/photos?${params.toString()}`);
  if (!res.ok) throw new Error("Gagal memuat galeri");
  const json = await res.json();
  const data: GalleryPickerPhoto[] = (json.data || []).map((p: any) => ({
    id: p.id,
    url: p.url,
    thumbnailUrl: p.thumbnailUrl ?? null,
  }));
  return { data, nextCursor: json.nextCursor ?? null, hasMore: !!json.hasMore };
}

export default function GalleryPicker({
  open,
  onClose,
  onSelect,
  multi = false,
  selectedIds = [],
  title = "Pilih Foto dari Galeri",
}: Props) {
  const [photos, setPhotos] = useState<GalleryPickerPhoto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const loadInitial = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const { data, nextCursor, hasMore: more } = await fetchPhotos(null);
      if (id !== reqId.current) return;
      setPhotos(data);
      setCursor(nextCursor);
      setHasMore(more);
    } catch {
      if (id === reqId.current) setError("Gagal memuat galeri");
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore || loading) return;
    const id = ++reqId.current;
    setLoadingMore(true);
    try {
      const { data, nextCursor, hasMore: more } = await fetchPhotos(cursor);
      if (id !== reqId.current) return;
      setPhotos((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...data.filter((p) => !seen.has(p.id))];
      });
      setCursor(nextCursor);
      setHasMore(more);
    } catch {
      if (id === reqId.current) setError("Gagal memuat lebih banyak");
    } finally {
      if (id === reqId.current) setLoadingMore(false);
    }
  }, [cursor, loadingMore, loading]);

  // Load the gallery whenever the picker opens.
  useEffect(() => {
    if (open) loadInitial();
  }, [open, loadInitial]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative mx-4 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex-shrink-0 border-b border-border p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-base font-semibold">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 transition-colors hover:bg-muted"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : photos.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageOff className="h-6 w-6" />
            <p className="text-sm">Belum ada foto di galeri</p>
          </div>
        ) : (
          <>
            <div className="grid w-full grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {photos.map((photo) => {
                const selected = selectedIds.includes(photo.id);
                return (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => onSelect(photo)}
                    className={cn(
                      "relative w-full overflow-hidden rounded-lg transition-all",
                      selected
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-card"
                        : "hover:ring-1 hover:ring-primary/50",
                    )}
                    style={{ aspectRatio: "1 / 1" }}
                  >
                    <div className="absolute inset-0">
                      <Image
                        src={photo.thumbnailUrl || photo.url}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                        className="object-cover"
                      />
                    </div>
                    {selected && (
                      <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm text-white shadow-lg">
                          ✓
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {hasMore && (
              <div className="mt-4 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Memuat...
                    </>
                  ) : (
                    "Lihat lebih banyak"
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex-shrink-0 border-t border-border p-4">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onClose}
        >
          {multi ? "Selesai" : "Tutup"}
        </Button>
      </div>
      </div>
    </div>
  );
}
