import NewLetterForm from "@/components/letters/NewLetterForm";
import PageTransition from "@/components/PageTransition";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "New Letter" };

export default function NewLetterPage() {
  return (
    <PageTransition>
      <div>
        <div className="mb-8">
          <h1 className="font-heading text-3xl">Tulis Surat ✍️</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ungkapkan isi hatimu untuk pasangan
          </p>
        </div>

        <NewLetterForm />
      </div>
    </PageTransition>
  );
}
