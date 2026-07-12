import { Suspense } from "react";
import TimelineManager from "@/components/dashboard/TimelineManager";
import PageTransition from "@/components/PageTransition";
import { Skeleton } from "@/components/ui";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Timeline" };

export default function TimelineManagerPage() {
  return (
    <PageTransition>
      <div>
        <div className="mb-8">
          <h1 className="font-heading text-3xl">Kelola Timeline</h1>
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
  );
}
