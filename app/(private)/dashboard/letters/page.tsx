import { Mail } from "lucide-react";
import LetterList from "@/components/letters/LetterList";
import PageTransition from "@/components/PageTransition";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Letters" };

export default function LettersPage() {
  return (
    <PageTransition>
      <div>
        <div className="mb-8">
          <h1 className="flex items-center gap-2 font-heading text-xl sm:text-2xl lg:text-3xl break-words"><Mail className="h-6 w-6 text-primary" aria-hidden="true" /> Love Letters</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Surat cinta untuk pasanganmu
          </p>
        </div>

        <LetterList />
      </div>
    </PageTransition>
  );
}
