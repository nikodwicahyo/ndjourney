import { Suspense } from "react";
import NotesManager from "@/components/dashboard/NotesManager";
import PageTransition from "@/components/PageTransition";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Notes" };

export default function NotesManagerPage() {
  return (
    <PageTransition>
      <div>
        <div className="mb-8">
          <h1 className="font-heading text-3xl">Kelola Daily Note</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tulis dan lihat riwayat catatan harian
          </p>
        </div>

        <Suspense fallback={null}>
          <NotesManager />
        </Suspense>
      </div>
    </PageTransition>
  );
}
