import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import NewLetterFormLoader from "@/components/letters/NewLetterFormLoader";
import PageTransition from "@/components/PageTransition";
import { PenLine } from "lucide-react";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "New Letter" };

export default async function NewLetterPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8">
          <h1 className="flex items-center gap-2 font-heading text-xl sm:text-2xl lg:text-3xl break-words"><PenLine className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" /> Tulis Surat</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ungkapkan isi hatimu untuk pasangan
          </p>
        </div>

        <NewLetterFormLoader userId={session.user.id} />
      </div>
    </PageTransition>
  );
}
