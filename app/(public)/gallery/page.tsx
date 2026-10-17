import { Suspense } from "react";
import type { Metadata } from "next";
import PublicGallery from "@/components/gallery/PublicGallery";
import PageTransition from "@/components/PageTransition";
import ScrollToTopButton from "@/components/ui/ScrollToTopButton";
import { cn, GALLERY_GRID_CLASSES, GALLERY_TILE_CLASSES } from "@/lib/utils";

export const metadata: Metadata = { title: "Gallery" };

export const revalidate = 60;

export default function GalleryPage() {
  return (
    <PageTransition>
      <Suspense
        fallback={
          <div className="space-y-6 overflow-hidden">
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
        }
      >
        <PublicGallery />
      </Suspense>

      <ScrollToTopButton variant="public" />
    </PageTransition>
  );
}
