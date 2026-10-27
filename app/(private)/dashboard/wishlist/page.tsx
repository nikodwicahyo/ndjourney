import { Suspense } from "react";
import { HydrationBoundary } from "@tanstack/react-query";
import WishlistManager from "@/components/dashboard/WishlistManager";
import PageTransition from "@/components/PageTransition";
import { auth } from "@/lib/auth";
import { getUserCoupleId } from "@/lib/couple";
import { listWishes } from "@/lib/queries/wishes";
import { prefetchServerQueries } from "@/lib/server-prefetch";
// Keys come from the shared module, never from the "use client" hook file —
// client-module exports are reference proxies in RSC, not callable values.
import { queryKeys } from "@/lib/query-keys";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Wishlist" };

export default async function WishlistManagerPage() {
  // Seed react-query server-side so the first paint already contains the wish
  // cards (and their images) instead of waiting for the client fetch waterfall.
  const state = await prefetchServerQueries([async (qc) => {
    const session = await auth();
    const coupleId = session?.user ? await getUserCoupleId(session.user.id) : null;
    if (!coupleId) return;
    await qc.prefetchQuery({
      queryKey: queryKeys.wishes.list(),
      queryFn: async () => (await listWishes(coupleId)).data,
    });
  }]);

  return (
    <HydrationBoundary state={state}>
      <PageTransition>
        <div>
          <div className="mb-8">
            <h1 className="font-heading text-xl sm:text-2xl lg:text-3xl break-words">Kelola Wish List</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tambah, edit, dan kelola wish list
            </p>
          </div>

          <Suspense
            fallback={
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
                ))}
              </div>
            }
          >
            <WishlistManager />
          </Suspense>
        </div>
      </PageTransition>
    </HydrationBoundary>
  );
}
