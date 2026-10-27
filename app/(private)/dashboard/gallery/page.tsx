import { Suspense } from "react";
import { HydrationBoundary } from "@tanstack/react-query";
import GalleryManager from "@/components/dashboard/GalleryManager";
import PageTransition from "@/components/PageTransition";
import { Skeleton } from "@/components/ui";
import { cn, GALLERY_GRID_CLASSES, GALLERY_TILE_CLASSES, PHOTO_PAGE_SIZE } from "@/lib/utils";
import ScrollToTopButton from "@/components/ui/ScrollToTopButton";
import { auth } from "@/lib/auth";
import { getUserCoupleId } from "@/lib/couple";
import { listPhotos } from "@/lib/queries/photos";
import { prefetchServerQueries } from "@/lib/server-prefetch";
import { photoKeys } from "@/hooks/usePhotos";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Gallery" };

// Must mirror GalleryManager's initial filter state — the react-query key is
// built from it, and hydration only matches on an identical key.
const INITIAL_FILTERS = {
  mediaType: undefined,
  sort: undefined,
  albumId: undefined,
  isFavorite: undefined,
  visibility: "public" as const,
};

export default async function GalleryManagerPage() {
  // Seed react-query server-side so the first photo tiles paint with the first
  // HTML instead of waiting for the client fetch waterfall.
  const state = await prefetchServerQueries([async (qc) => {
    const session = await auth();
    const userId = session?.user?.id ?? "anon";
    const coupleId = session?.user ? await getUserCoupleId(session.user.id) : null;
    const { visibility } = INITIAL_FILTERS;
    await qc.prefetchInfiniteQuery({
      queryKey: photoKeys.list({ ...INITIAL_FILTERS, isPublic: undefined, visibility }),
      initialPageParam: null as string | null,
      queryFn: async ({ pageParam }) =>
        listPhotos(
          {
            albumId: INITIAL_FILTERS.albumId ?? null,
            year: null,
            isFavorite: INITIAL_FILTERS.isFavorite ? "true" : null,
            mediaType: INITIAL_FILTERS.mediaType ?? null,
            visibility,
            sort: INITIAL_FILTERS.sort ?? null,
            cursor: pageParam,
            limit: PHOTO_PAGE_SIZE,
          },
          { isAuthed: !!session?.user, userId, coupleId },
        ),
    });
  }]);

  return (
    <HydrationBoundary state={state}>
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
      </PageTransition>

      <ScrollToTopButton />
    </HydrationBoundary>
  );
}
