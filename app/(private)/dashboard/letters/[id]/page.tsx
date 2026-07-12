import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LetterViewer from "@/components/letters/LetterViewer";
import PageTransition from "@/components/PageTransition";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Letter" };

export default async function LetterDetailPage({
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
      <div>
        <LetterViewer id={id} isRecipient={isRecipient} />
      </div>
    </PageTransition>
  );
}
