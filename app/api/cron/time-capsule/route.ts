import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { sendEmail, timeCapsuleNotificationHtml } from "@/lib/resend";
import { triggerCoupleEvent } from "@/lib/pusher-server";
import { invalidateCache } from "@/lib/redis";


export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("CRON_SECRET is not configured");
      return NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500 },
      );
    }

    const token = authHeader?.replace("Bearer ", "");
    if (token !== cronSecret) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const now = new Date();

    const unlockedLetters = await prisma.letter.findMany({
      where: {
        isTimeCapsule: true,
        isOpened: false,
        notificationSentAt: null,
        unlockAt: { lte: now },
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
        recipient: { select: { id: true, name: true, email: true } },
      },
    });

    const affectedCouples = new Set<string>();

    for (const letter of unlockedLetters) {
      if (letter.coupleId) {
        affectedCouples.add(letter.coupleId);
      }
    }

    const results: Array<{ letterId: string; emailSent: boolean; error?: string }> = [];

    // ponytail: per-letter isolation — one failing send/update must not skip the rest
    for (const letter of unlockedLetters) {
      try {
        if (letter.recipient.email) {
          const emailResult = await sendEmail({
            to: letter.recipient.email,
            subject: `🎁 Time Capsule dari ${letter.author.name || "Pasangan"} telah terbuka!`,
            html: timeCapsuleNotificationHtml(
              letter.author.name || "Pasangan",
              letter.title,
              `${process.env.NEXTAUTH_URL}/letters/${letter.id}`,
            ),
          });

          const emailSent = !emailResult?.error;

          if (emailResult?.error) {
            console.error(
              `Failed to send time-capsule notification for letter ${letter.id} to ${letter.recipient.email}:`,
              emailResult.error,
            );
          }

          if (emailSent) {
            await prisma.letter.update({
              where: { id: letter.id },
              data: { notificationSentAt: now },
              select: { id: true },
            });
          }

          results.push({
            letterId: letter.id,
            emailSent,
            ...(emailResult?.error ? { error: String(emailResult.error) } : {}),
          });
        } else {
          await prisma.letter.update({
            where: { id: letter.id },
            data: { notificationSentAt: now },
            select: { id: true },
          });

          results.push({
            letterId: letter.id,
            emailSent: false,
          });
        }
      } catch (e) {
        console.error(`Time-capsule letter ${letter.id} failed, continuing:`, e);
        results.push({
          letterId: letter.id,
          emailSent: false,
          error: e instanceof Error ? e.message : "Gagal memproses",
        });
      }
    }

    await invalidateCache("letters:*");
    await invalidateCache("dashboard:*");

    for (const coupleId of affectedCouples) {
      triggerCoupleEvent(coupleId, 'LETTERS');
    }

    return NextResponse.json({
      message: `Processed ${unlockedLetters.length} time capsules`,
      results,
    });
  } catch (error) {
    console.error("Time capsule cron error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
