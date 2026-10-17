import { Suspense } from "react";
import GalleryManager from "@/components/dashboard/GalleryManager";
import PageTransition from "@/components/PageTransition";
import { Skeleton } from "@/components/ui";
import { cn, GALLERY_GRID_CLASSES, GALLERY_TILE_CLASSES } from "@/lib/utils";
import ScrollToTopButton from "@/components/ui/ScrollToTopButton";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Gallery" };

export default function GalleryManagerPage() {
  return (
    <PageTransition>
      <div>
        <div className="mb-6">
          <h1 className="font-heading text-xl sm:text-2xl lg:text-3xl break-words">Kelola Gallery</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload dan kelola media, dan album
          </p>
        </div>

        <Suspense
          fallback={
            <div className="space-y-6">
              <Skeleton className="h-10 w-32" />
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
          <GalleryManager />
        </Suspense>
      </div>

      <ScrollToTopButton />
    </PageTransition>
  );
}
