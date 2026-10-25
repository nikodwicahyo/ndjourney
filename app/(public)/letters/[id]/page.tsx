import type { Metadata } from "next";
import LetterViewer from "@/components/letters/LetterViewer";
import PageTransition from "@/components/PageTransition";

export const metadata: Metadata = { title: "Letter" };

export default async function PublicLetterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <LetterViewer id={id} backHref="/letters" />
      </div>
    </PageTransition>
  );
}
