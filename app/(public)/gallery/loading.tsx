import { cn, GALLERY_GRID_CLASSES, GALLERY_TILE_CLASSES } from "@/lib/utils";

export default function GalleryLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div className="h-8 w-48 animate-pulse rounded-full bg-muted" />
      <div className="h-6 w-64 animate-pulse rounded-full bg-muted" />
      <div className={GALLERY_GRID_CLASSES}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className={cn(GALLERY_TILE_CLASSES, "animate-pulse rounded-2xl bg-muted")}
          />
        ))}
      </div>
    </div>
  );
}
