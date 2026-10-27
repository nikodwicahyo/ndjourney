import { Suspense } from "react";
import { HydrationBoundary } from "@tanstack/react-query";
import GameManager from "@/components/dashboard/GameManager";
import LeaderBoard from "@/components/dashboard/LeaderBoard";
import PageTransition from "@/components/PageTransition";
import { Skeleton } from "@/components/ui";
import { listGameQuestions, getQaLeaderboard } from "@/lib/queries/games";
import { prefetchServerQueries } from "@/lib/server-prefetch";
import { queryKeys } from "@/lib/query-keys";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Games" };

// GameManager's initial query key (default sort desc) — hydration only
// matches on an identical key.
const QUESTIONS_ADMIN_KEY = ["games", "questions", "all", "desc"] as const;

export default async function GamesManagerPage() {
  // Seed react-query server-side so questions/leaderboard paint with the
  // first HTML instead of waiting for the client fetch waterfall.
  const state = await prefetchServerQueries([
    async (qc) => {
      await qc.prefetchQuery({
        queryKey: QUESTIONS_ADMIN_KEY,
        // Same effective params the API serves: the route clamps limit to 200.
        queryFn: async () => (await listGameQuestions({ sort: "desc", limit: 200 })).data,
      });
    },
    async (qc) => {
      // LeaderBoard's initial "Semua" tab runs both of these (arcade query is
      // disabled until its tab is selected).
      await qc.prefetchQuery({
        queryKey: [...queryKeys.games.leaderboard(), null],
        queryFn: () => getQaLeaderboard(null),
      });
      await qc.prefetchQuery({
        queryKey: queryKeys.games.mergedQaLeaderboard(),
        queryFn: () => getQaLeaderboard(null),
      });
    },
  ]);

  return (
    <HydrationBoundary state={state}>
      <PageTransition>
        <div className="w-full max-w-full space-y-8">
          <div>
            <div className="mb-8">
              <h1 className="font-heading text-xl sm:text-2xl lg:text-3xl break-words">Kelola Games</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Atur pertanyaan dan lihat leaderboard
              </p>
            </div>

            <Suspense
              fallback={<Skeleton className="h-40 w-full rounded-2xl" />}
            >
              <GameManager />
            </Suspense>
          </div>

          <div>
            <h2 className="mb-4 font-heading text-lg font-semibold">Leaderboard</h2>
            <Suspense
              fallback={
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-xl" />
                  ))}
                </div>
              }
            >
              <LeaderBoard />
            </Suspense>
          </div>
        </div>
      </PageTransition>
    </HydrationBoundary>
  );
}
