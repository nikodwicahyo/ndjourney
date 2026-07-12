import { Suspense } from "react";
import GalleryManager from "@/components/dashboard/GalleryManager";
import PageTransition from "@/components/PageTransition";
import { Skeleton } from "@/components/ui";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Gallery" };

export default function GalleryManagerPage() {
  return (
    <PageTransition>
      <div>
        <div className="mb-8">
          <h1 className="font-heading text-xl sm:text-2xl lg:text-3xl break-words">Kelola Gallery</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload dan kelola media, dan album
          </p>
        </div>

        <Suspense
          fallback={
            <div className="space-y-6">
              <Skeleton className="h-10 w-32" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-muted" />
                ))}
              </div>
            </div>
          }
        >
          <GalleryManager />
        </Suspense>
      </div>
    </PageTransition>
  );
}
