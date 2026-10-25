import LetterViewer from "@/components/letters/LetterViewer";
import PageTransition from "@/components/PageTransition";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Letter" };

export default async function LetterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <PageTransition>
      <div>
        <LetterViewer id={id} />
      </div>
    </PageTransition>
  );
}
