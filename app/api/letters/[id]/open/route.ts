import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { sendEmail, letterNotificationHtml } from "@/lib/resend";
import { invalidateCache } from "@/lib/redis";


export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const letter = await prisma.letter.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });

    if (!letter) {
      return NextResponse.json({ error: "Letter not found" }, { status: 404 });
    }

    if (letter.recipientId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (letter.isOpened) {
      return NextResponse.json({ error: "Already opened" }, { status: 400 });
    }

    if (letter.isTimeCapsule && letter.unlockAt && letter.unlockAt > new Date()) {
      return NextResponse.json(
        { error: "Time capsule is still locked" },
        { status: 423 },
      );
    }

    const updated = await prisma.letter.update({
      where: { id },
      data: {
        isOpened: true,
        openedAt: new Date(),
      },
      select: {
        id: true,
        isOpened: true,
        openedAt: true,
      },
    });

    if (letter.author.email) {
      const emailResult = await sendEmail({
        to: letter.author.email,
        subject: `${session.user.name} telah membaca suratmu 💕`,
        html: letterNotificationHtml(
          session.user.name || "Pasangan",
          letter.title,
          `${process.env.NEXTAUTH_URL}/letters/${letter.id}`,
        ),
      });
      if (emailResult?.error) {
        console.error(
          `Failed to send open notification to ${letter.author.email}:`,
          emailResult.error,
        );
      }
    }

    await invalidateCache("letters:*");

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Error opening letter:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
