import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { sendEmail, letterNotificationHtml } from "@/lib/resend";
import { invalidateCache } from "@/lib/redis";
import { getUserCoupleId } from "@/lib/couple";
import { triggerCoupleEvent } from "@/lib/pusher-server";


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
      return NextResponse.json({ error: "Surat tidak ditemukan" }, { status: 404 });
    }

    if (letter.recipientId !== session.user.id) {
      return NextResponse.json({ error: "Kamu tidak punya akses untuk membuka surat ini" }, { status: 403 });
    }

    if (letter.isOpened) {
      return NextResponse.json({ error: "Surat ini sudah dibuka" }, { status: 400 });
    }

    if (letter.isTimeCapsule && letter.unlockAt && letter.unlockAt > new Date()) {
      return NextResponse.json(
        { error: "Time capsule masih terkunci sampai waktu yang ditentukan" },
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
    await invalidateCache("dashboard:*");

    const coupleId = await getUserCoupleId(session.user.id);
    if (coupleId) {
      triggerCoupleEvent(coupleId, 'LETTERS');
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Error opening letter:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
