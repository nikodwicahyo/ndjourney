import { Suspense } from "react";
import LetterList from "@/components/letters/LetterList";
import PageTransition from "@/components/PageTransition";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Letters" };

export default function LettersPage() {
  return (
    <PageTransition>
      <div>
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
          <LetterList />
        </Suspense>
      </div>
    </PageTransition>
  );
}
