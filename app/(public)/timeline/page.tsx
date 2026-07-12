import { Suspense } from "react";
import type { Metadata } from "next";
import PublicTimelineList from "@/components/timeline/PublicTimelineList";
import PageTransition from "@/components/PageTransition";

export const metadata: Metadata = { title: "Timeline" };

export const revalidate = 60;

export default function TimelinePage() {
  return (
    <PageTransition>
      <div className="mb-8">
        <h1 className="font-heading text-3xl">Love Timeline</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Setiap momen indah dalam perjalanan kita
        </p>
      </div>

      <Suspense
        fallback={
          <div className="space-y-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-3">
                  <div className="h-6 w-48 animate-pulse rounded-full bg-muted" />
                  <div className="h-20 w-full animate-pulse rounded-2xl bg-muted" />
                </div>
              </div>
            ))}
          </div>
        }
      >
        <PublicTimelineList />
      </Suspense>
    </PageTransition>
  );
}
