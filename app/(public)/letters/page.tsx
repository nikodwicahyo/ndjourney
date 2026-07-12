import { Suspense } from "react";
import type { Metadata } from "next";
import PublicLetterInbox from "@/components/letters/PublicLetterInbox";
import PageTransition from "@/components/PageTransition";

export const metadata: Metadata = { title: "Letters" };

export const dynamic = "force-dynamic";

export default function PublicLettersPage() {
  return (
    <PageTransition>
      <div className="mb-8">
        <h1 className="font-heading text-xl sm:text-2xl lg:text-3xl break-words">Love Letters 💌</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Surat cinta untuk pasanganmu
        </p>
      </div>

      <Suspense
        fallback={
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex animate-pulse gap-4 rounded-2xl border border-border bg-card p-4"
              >
                <div className="h-10 w-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-48 rounded-full bg-muted" />
                  <div className="h-4 w-32 rounded-full bg-muted" />
                </div>
              </div>
            ))}
          </div>
        }
      >
        <PublicLetterInbox />
      </Suspense>
    </PageTransition>
  );
}
