import { Suspense } from "react";
import type { Metadata } from "next";
import { NoteList } from "@/components/notes";
import PageTransition from "@/components/PageTransition";

export const metadata: Metadata = { title: "Notes" };

export default async function NotesPage() {
  return (
    <PageTransition>
      <div className="mb-8">
        <h1 className="font-heading text-xl sm:text-2xl lg:text-3xl break-words">Daily Note 📝</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Catatan harian dari Niko & Dzikria
        </p>
      </div>

      <div className="mx-auto max-w-lg space-y-8">
        <Suspense
          fallback={
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          }
        >
          <NoteList />
        </Suspense>
      </div>
    </PageTransition>
  );
}
