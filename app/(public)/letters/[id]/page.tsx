import { auth } from "@/lib/auth";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import LetterViewer from "@/components/letters/LetterViewer";
import PageTransition from "@/components/PageTransition";

export const metadata: Metadata = { title: "Letter" };

export const dynamic = "force-dynamic";

export default async function PublicLetterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  let isRecipient = false;

  if (session?.user) {
    const letter = await prisma.letter.findUnique({
      where: { id },
      select: { recipientId: true },
    });
    isRecipient = letter?.recipientId === session.user.id;
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <LetterViewer id={id} isRecipient={isRecipient} backHref="/letters" />
      </div>
    </PageTransition>
  );
}
