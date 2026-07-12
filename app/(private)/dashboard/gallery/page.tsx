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
          <h1 className="font-heading text-3xl">Kelola Gallery</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload dan kelola media, dan album
          </p>
        </div>

        <Suspense
          fallback={
            <div className="space-y-6">
              <Skeleton className="h-10 w-32" />
              <div className="columns-2 gap-3 md:columns-3 lg:columns-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="mb-3 aspect-[3/4] animate-pulse rounded-2xl bg-muted" />
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
