import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { sendEmail, timeCapsuleNotificationHtml } from "@/lib/resend";
import { triggerCoupleEvent } from "@/lib/pusher-server";
import { invalidateCache } from "@/lib/redis";
import type { Prisma } from "@/lib/generated/prisma";

type UnlockedLetter = Prisma.LetterGetPayload<{
  include: {
    author: { select: { id: true; name: true; email: true } };
    recipient: { select: { id: true; name: true; email: true } };
  };
}>;


export const maxDuration = 300;

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

    // ponytail: bounded batches (100/iter, max 10) with keyset pagination —
    // same "process all" semantics as unbounded findMany, without the
    // OOM/email-storm ceiling or the degrading notIn:processedIds list.
    // (cursor API needs a unique — unlockAt isn't one — so keyset via row filter.)
    const BATCH = 100;
    const MAX_BATCHES = 10;
    const unlockedLetters: UnlockedLetter[] = [];
    let lastUnlockAt: Date | null = null;
    let lastId = "";
    for (let i = 0; i < MAX_BATCHES; i++) {
      const batch: UnlockedLetter[] = await prisma.letter.findMany({
        where: {
          isTimeCapsule: true,
          isOpened: false,
          notificationSentAt: null,
          unlockAt: { lte: now },
          ...(lastUnlockAt
            ? {
                OR: [
                  { unlockAt: { gt: lastUnlockAt } },
                  { unlockAt: lastUnlockAt, id: { gt: lastId } },
                ],
              }
            : {}),
        },
        take: BATCH,
        orderBy: [{ unlockAt: "asc" }, { id: "asc" }],
        include: {
          author: { select: { id: true, name: true, email: true } },
          recipient: { select: { id: true, name: true, email: true } },
        },
      });
      if (batch.length === 0) break;
      unlockedLetters.push(...batch);
      const last = batch[batch.length - 1];
      lastUnlockAt = last.unlockAt;
      lastId = last.id;
      if (batch.length < BATCH) break;
    }

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
            // ponytail: no recipient PII in logs.
            console.error(
              `Failed to send time-capsule notification for letter ${letter.id}:`,
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

    // ponytail: no-op runs must not wipe warm caches.
    if (unlockedLetters.length > 0) {
      await invalidateCache("letters:*");
      await invalidateCache("dashboard:*");
    }

    // ponytail: awaited fan-out — floating promises hid realtime failures.
    for (const coupleId of affectedCouples) {
      await triggerCoupleEvent(coupleId, 'LETTERS');
    }

    // ponytail: report if the batch cap left items for the next run.
    const remaining =
      unlockedLetters.length >= BATCH * MAX_BATCHES
        ? await prisma.letter.count({
            where: {
              isTimeCapsule: true,
              isOpened: false,
              notificationSentAt: null,
              unlockAt: { lte: now },
            },
          })
        : 0;

    return NextResponse.json({
      message: `Processed ${unlockedLetters.length} time capsules`,
      results,
      ...(remaining > 0 ? { remaining } : {}),
    });
  } catch (error) {
    console.error("Time capsule cron error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
