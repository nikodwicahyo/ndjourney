import { Suspense } from "react";
import { HydrationBoundary } from "@tanstack/react-query";
import GameManager from "@/components/dashboard/GameManager";
import LeaderBoard from "@/components/dashboard/LeaderBoard";
import PageTransition from "@/components/PageTransition";
import { Skeleton } from "@/components/ui";
import { listGameQuestions, getGameLeaderboard, getGameQuestionCounts } from "@/lib/queries/games";
import { auth } from "@/lib/auth";
import { getUserCoupleId } from "@/lib/couple";
import { GAME_QUESTION_PAGE_SIZE } from "@/lib/utils";
import { prefetchServerQueries } from "@/lib/server-prefetch";
import { queryKeys } from "@/lib/query-keys";
import { Gamepad2 } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Games" };

// GameManager's initial query key (default tab + sort + first page) — hydration
// only matches on an identical key.
const INITIAL_TAB = "WOULD_YOU_RATHER" as const;
const INITIAL_SORT = "desc" as const;

export default async function GamesManagerPage() {
  // Leaderboard moderation is a couple-member action (the API re-checks it on
  // every write). Only the dashboard asks for the controls; the public board
  // renders them for nobody.
  const session = await auth();
  const canModerate = !!session?.user?.id && !!(await getUserCoupleId(session.user.id));

  // Seed react-query server-side so questions/leaderboard paint with the
  // first HTML instead of waiting for the client fetch waterfall.
  const state = await prefetchServerQueries([
    async (qc) => {
      await qc.prefetchQuery({
        queryKey: queryKeys.games.adminQuestions(INITIAL_TAB, INITIAL_SORT, GAME_QUESTION_PAGE_SIZE),
        queryFn: async () => (await listGameQuestions({
          type: INITIAL_TAB,
          sort: INITIAL_SORT,
          limit: GAME_QUESTION_PAGE_SIZE,
          includeAnswer: true,
        })).data,
      });
    },
    async (qc) => {
      // Tab chips + "is there more?" — one aggregate query for every game type.
      await qc.prefetchQuery({
        queryKey: queryKeys.games.questionCounts,
        queryFn: getGameQuestionCounts,
      });
    },
    async (qc) => {
      // LeaderBoard's initial tab is the merged "Semua" board — one key, one
      // server-aggregated source for every game.
      await qc.prefetchQuery({
        queryKey: queryKeys.games.leaderboard(null),
        queryFn: () => getGameLeaderboard(null),
      });
    },
  ]);

  return (
    <HydrationBoundary state={state}>
      <PageTransition>
        <div className="w-full max-w-full space-y-8">
          <div>
            <div className="mb-8">
              <h1 className="flex items-center gap-2 font-heading text-xl sm:text-2xl lg:text-3xl break-words">
                <Gamepad2 className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
                Kelola Games
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Tambah dan kelola pertanyaan games serta atur leaderboard
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
              <LeaderBoard canModerate={canModerate} />
            </Suspense>
          </div>
        </div>
      </PageTransition>
    </HydrationBoundary>
  );
}
