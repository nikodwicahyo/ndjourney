import { Suspense } from "react";
import { HydrationBoundary } from "@tanstack/react-query";
import TimelineManager from "@/components/dashboard/TimelineManager";
import PageTransition from "@/components/PageTransition";
import { Skeleton } from "@/components/ui";
import { auth } from "@/lib/auth";
import { getUserCoupleId } from "@/lib/couple";
import { listMilestones } from "@/lib/queries/milestones";
import { prefetchServerQueries } from "@/lib/server-prefetch";
// Keys from the shared module — "use client" hook exports are reference
// proxies in RSC, not callable values.
import { queryKeys } from "@/lib/query-keys";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Timeline" };

export default async function TimelineManagerPage() {
  // Seed react-query server-side so milestones (and their photos) paint with
  // the first HTML instead of waiting for the client fetch waterfall.
  const state = await prefetchServerQueries([async (qc) => {
    const session = await auth();
    const coupleId = session?.user ? await getUserCoupleId(session.user.id) : null;
    await qc.prefetchQuery({
      queryKey: queryKeys.milestones.list(),
      queryFn: async () =>
        (await listMilestones({ isAuthed: true, coupleId, userId: session?.user?.id ?? null, page: 1, limit: 50 })).data,
    });
  }]);

  return (
    <HydrationBoundary state={state}>
      <PageTransition>
        <div>
          <div className="mb-8">
            <h1 className="font-heading text-xl sm:text-2xl lg:text-3xl break-words">Kelola Timeline</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tambah, edit, dan hapus milestone
            </p>
          </div>

          <Suspense
            fallback={
              <div className="space-y-8">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex gap-4">
                    <Skeleton className="hidden h-10 w-10 rounded-full md:block" />
                    <div className="flex-1 space-y-3">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            }
          >
            <TimelineManager />
          </Suspense>
        </div>
      </PageTransition>
    </HydrationBoundary>
  );
}
