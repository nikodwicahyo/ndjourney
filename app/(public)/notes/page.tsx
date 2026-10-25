import type { Metadata } from "next";
import { NoteList } from "@/components/notes";
import ManagePageButton from "@/components/layout/ManagePageButton";
import PageTransition from "@/components/PageTransition";
import { NotebookPen } from "lucide-react";
import { getPublicCoupleConfig } from "@/lib/couple-config";
import { formatCoupleNames } from "@/lib/couple-display";

export const metadata: Metadata = { title: "Notes" };

export const revalidate = 60;
export const dynamic = "force-static";

export default async function NotesPage() {
  const config = await getPublicCoupleConfig();
  return (
    <PageTransition>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-xl sm:text-2xl lg:text-3xl break-words"><NotebookPen className="h-6 w-6 text-primary" /> Daily Note</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catatan harian dari {formatCoupleNames(config?.name1, config?.name2)}
          </p>
        </div>
        <ManagePageButton href="/dashboard/notes" label="Tulis Catatan" />
      </div>

      <div className="mx-auto max-w-lg space-y-8">
        <NoteList />
      </div>
    </PageTransition>
  );
}
