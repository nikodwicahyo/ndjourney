"use client";

import { useAlbums } from "@/hooks/usePhotos";
import { cn } from "@/lib/utils";
import { Heart, X, Image, Video, ArrowUpDown } from "lucide-react";
import AlbumDropdown from "./AlbumDropdown";

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
  counts?: { all: number; foto: number; video: number };
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
  counts,
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
            {counts && (
              <span className={cn(
                "ml-0.5 tabular-nums",
                (filters.mediaType || "") === key ? "text-primary-foreground/70" : "text-muted-foreground/50",
              )}>
                {counts[key === "" ? "all" : key as "foto" | "video"]}
              </span>
            )}
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

      <AlbumDropdown
        albums={albums}
        value={filters.albumId || ""}
        onChange={(albumId) =>
          onFiltersChange({ ...filters, albumId: albumId || undefined })
        }
        placeholder="Semua Album"
      />

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
