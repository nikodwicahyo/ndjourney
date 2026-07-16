import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createLetterSchema } from "@/lib/validations/letter";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { getCached, setCached, invalidateCache, cacheKey } from "@/lib/redis";
import { batchLoadUsers, mapUsersToRecords } from "@/lib/batch";
import { sendEmail, letterNotificationHtml } from "@/lib/resend";
import { triggerCoupleEvent } from "@/lib/pusher-server";

const CACHE_TTL = 30;

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "inbox";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    const cacheK = cacheKey("letters", type, session.user.id, String(page), String(limit));
    const cached = await getCached<unknown>(cacheK);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "private, no-cache" },
      });
    }

    const where =
      type === "sent"
        ? { authorId: session.user.id }
        : { recipientId: session.user.id };

    const [letters, total] = await Promise.all([
      prisma.letter.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          authorId: true,
          recipientId: true,
          isTimeCapsule: true,
          unlockAt: true,
          isOpened: true,
          openedAt: true,
          mood: true,
          isPublic: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.letter.count({ where }),
    ]);

    const userIds = letters.flatMap((l) => [l.authorId, l.recipientId]);
    const userMap = await batchLoadUsers(userIds);
    const data = mapUsersToRecords(letters, userMap);

    const response = { data, total, page, limit };

    await setCached(cacheK, response, CACHE_TTL);

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, no-cache" },
    });
  } catch (error) {
    console.error("Error fetching letters:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const rateCheck = await withRateLimit(request, rateLimitConfigs.letter);
    if (!rateCheck.allowed) {
      return rateCheck.response;
    }

    const session = rateCheck.session;

    const body = await request.json();
    const parsed = createLetterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data surat tidak valid" },
        { status: 400 },
      );
    }

    let membership: { couple: { id: string; members: Array<{ userId: string }> } } | null = null;

    if (parsed.data.recipientId) {
      membership = await prisma.coupleMember.findUnique({
        where: { userId: session.user.id },
        select: {
          couple: {
            select: {
              id: true,
              members: {
                where: { userId: { not: session.user.id } },
                select: { userId: true },
              },
            },
          },
        },
      });

      const validRecipients =
        membership?.couple?.members?.map((m) => m.userId) ?? [];

      if (!validRecipients.includes(parsed.data.recipientId)) {
        return NextResponse.json(
          { error: "Penerima harus pasangan kamu dalam pasangan ini" },
          { status: 403 },
        );
      }
    }

    const letter = await prisma.letter.create({
      data: {
        ...parsed.data,
        authorId: session.user.id,
        coupleId: membership?.couple?.id ?? null,
        unlockAt: parsed.data.unlockAt
          ? new Date(parsed.data.unlockAt)
          : null,
      },
      select: {
        id: true,
        title: true,
        content: true,
        authorId: true,
        recipientId: true,
        isTimeCapsule: true,
        unlockAt: true,
        isOpened: true,
        mood: true,
        isPublic: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const userMap = await batchLoadUsers([letter.authorId, letter.recipientId]);
    const enriched = mapUsersToRecords([letter], userMap)[0];

    if (!parsed.data.isTimeCapsule) {
      const recipient = userMap.get(letter.recipientId);
      if (recipient?.email) {
        const emailResult = await sendEmail({
          to: recipient.email,
          subject: `💌 Surat Baru dari ${session.user.name || "Pasangan"}!`,
          html: letterNotificationHtml(
            session.user.name || "Pasangan",
            letter.title,
            `${process.env.NEXTAUTH_URL}/letters/${letter.id}`,
          ),
        });
        if (emailResult?.error) {
          console.error(
            `Failed to send letter notification to ${recipient.email}:`,
            emailResult.error,
          );
        }
      }
    }

    await invalidateCache("letters:*");
    await invalidateCache("dashboard:*");

    const coupleId = membership?.couple?.id;
    if (coupleId) {
      triggerCoupleEvent(coupleId, 'LETTERS');
    }

    return NextResponse.json({ data: enriched }, { status: 201 });
  } catch (error) {
    console.error("Error creating letter:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
