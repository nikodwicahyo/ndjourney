"use client";

import { useAlbums } from "@/hooks/usePhotos";
import { cn } from "@/lib/utils";
import { Folder, Heart, X, Image, Video, ArrowUpDown } from "lucide-react";

type FilterState = {
  albumId?: string;
  year?: number;
  isFavorite?: boolean;
  mediaType?: string;
  sort?: string;
};

type AlbumSelectorProps = {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  isPublic?: boolean;
};

const MEDIA_TABS = [
  { key: "", label: "Semua", icon: null },
  { key: "foto", label: "Foto", icon: Image },
  { key: "video", label: "Video", icon: Video },
] as const;

export default function AlbumSelector({
  filters,
  onFiltersChange,
  isPublic,
}: AlbumSelectorProps) {
  const { data: albums, isLoading } = useAlbums();

  const hasActiveFilters = filters.albumId || filters.year || filters.isFavorite;

  function clearFilters() {
    onFiltersChange({});
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Media type tabs */}
      <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
        {MEDIA_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onFiltersChange({ ...filters, mediaType: key || undefined })}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              (filters.mediaType || "") === key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {label}
          </button>
        ))}
      </div>

      <button
        onClick={() => onFiltersChange({ ...filters, isFavorite: !filters.isFavorite })}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
          filters.isFavorite
            ? "border-primary bg-primary/10 text-primary"
            : "border-border text-muted-foreground hover:bg-accent",
        )}
      >
        <Heart
          className={cn(
            "h-3.5 w-3.5",
            filters.isFavorite && "fill-primary",
          )}
        />
        Favorit
      </button>

      <div className="relative">
        <select
          value={filters.albumId || ""}
          onChange={(e) =>
            onFiltersChange({ ...filters, albumId: e.target.value || undefined })
          }
          className={cn(
            "appearance-none rounded-full border px-3 py-1.5 pr-7 text-xs font-medium outline-none transition-colors",
            filters.albumId
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:bg-accent",
          )}
        >
          <option value="">Semua Album</option>
          {isLoading && <option disabled>Memuat...</option>}
          {albums?.map((album) => (
            <option key={album.id} value={album.id}>
              {album.name} ({album._count.photos})
            </option>
          ))}
        </select>
        <Folder className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
      </div>

      {/* Sort toggle */}
      <button
        onClick={() =>
          onFiltersChange({
            ...filters,
            sort: filters.sort === "oldest" ? undefined : "oldest",
          })
        }
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
          filters.sort === "oldest"
            ? "border-primary bg-primary/10 text-primary"
            : "border-border text-muted-foreground hover:bg-accent",
        )}
      >
        <ArrowUpDown className="h-3.5 w-3.5" />
        {filters.sort === "oldest" ? "Terlama" : "Terbaru"}
      </button>

      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
        >
          <X className="h-3 w-3" />
          Reset
        </button>
      )}
    </div>
  );
}
