import { Suspense } from "react";
import NotesManager from "@/components/dashboard/NotesManager";
import PageTransition from "@/components/PageTransition";
import { NotebookPen } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Notes" };

export default function NotesManagerPage() {
  return (
    <PageTransition>
      <div>
        <div className="mb-8">
          <h1 className="flex items-center gap-2 font-heading text-xl sm:text-2xl lg:text-3xl break-words">
            <NotebookPen className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
            Kelola Daily Note
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tulis dan lihat riwayat catatan harian kalian
          </p>
        </div>

        <Suspense
          fallback={
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          }
        >
          <NotesManager />
        </Suspense>
      </div>
    </PageTransition>
  );
}
