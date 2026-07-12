import { Suspense } from "react";
import GameManager from "@/components/dashboard/GameManager";
import LeaderBoard from "@/components/dashboard/LeaderBoard";
import PageTransition from "@/components/PageTransition";
import { Skeleton } from "@/components/ui";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Games" };

export default function GamesManagerPage() {
  return (
    <PageTransition>
      <div className="space-y-8">
        <div>
          <div className="mb-8">
            <h1 className="font-heading text-3xl">Kelola Games</h1>
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
  );
}
