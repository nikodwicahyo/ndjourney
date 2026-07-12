import { Suspense } from "react";
import { DashboardClient } from "@/components/dashboard";
import PageTransition from "@/components/PageTransition";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <PageTransition>
      <Suspense
        fallback={
          <div className="space-y-8 w-full max-w-full overflow-hidden">
            <div className="h-10 w-64 animate-pulse rounded-xl bg-muted" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-28 animate-pulse rounded-2xl bg-muted"
                />
              ))}
            </div>
          </div>
        }
      >
        <DashboardClient />
      </Suspense>
    </PageTransition>
  );
}
