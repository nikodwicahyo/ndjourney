import { prisma } from "@/lib/prisma";
import { NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { createNoteSchema } from "@/lib/validations/note";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { getCached, setCached, invalidateCache, cacheKey } from "@/lib/redis";
import { batchLoadUsers, toPublicUser } from "@/lib/batch";
import { jakartaStartOfDay, toJakartaMidnight } from "@/lib/date";
import { getUserCoupleId } from "@/lib/couple";
import { triggerCoupleEvent } from "@/lib/pusher-server";
import { sendEmail, noteNotificationHtml } from "@/lib/resend";

const CACHE_TTL = 30;

export async function GET(request: Request) {
  try {
    // ponytail: GET stays public — /(public)/notes renders NoteList for visitors.
    // Privacy fix instead: author emails stripped (matches DailyNoteWithAuthor
    // type {id,name,image}), and logged-in members get a couple-scoped list.
    const session = await auth();
    const coupleId = session?.user ? await getUserCoupleId(session.user.id) : null;

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");

    const scopeSegment = coupleId ?? "anon";
    const cacheK = dateParam
      ? cacheKey("notes", scopeSegment, dateParam)
      : cacheKey("notes", scopeSegment, "all");
    const cached = await getCached<unknown>(cacheK);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "private, no-cache" },
      });
    }

    // ponytail: members see own couple (+ legacy null rows); visitors keep legacy all.
    const where: Record<string, unknown> = coupleId
      ? { OR: [{ coupleId }, { coupleId: null }] }
      : {};

    if (dateParam) {
      const start = toJakartaMidnight(dateParam);
      if (start) {
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        where.date = { gte: start, lt: end };
      }
    }

    const notes = await prisma.dailyNote.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        content: true,
        authorId: true,
        date: true,
        createdAt: true,
      },
    });

    const userIds = notes.map((n) => n.authorId);
    const userMap = await batchLoadUsers(userIds);

    // ponytail: strip emails — public page + declared type carry {id,name,image} only.
    const data = notes.map((n) => ({
      ...n,
      author: toPublicUser(userMap.get(n.authorId)),
    }));

    const response = { data };

    await setCached(cacheK, response, CACHE_TTL);

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, no-cache" },
    });
  } catch (error) {
    console.error("Error fetching notes:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const rateCheck = await withRateLimit(request, rateLimitConfigs.note);
    if (!rateCheck.allowed) {
      return rateCheck.response;
    }

    const session = rateCheck.session;

    const body = await request.json().catch(() => null);
    if (body == null) return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
    const parsed = createNoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data catatan tidak valid" },
        { status: 400 },
      );
    }

    const today = jakartaStartOfDay();

    const authorCoupleId = await getUserCoupleId(session.user.id);

    const note = await prisma.dailyNote.create({
      data: {
        content: parsed.data.content,
        authorId: session.user.id,
        date: today,
        coupleId: authorCoupleId,
      },
      select: {
        id: true,
        content: true,
        authorId: true,
        date: true,
        createdAt: true,
      },
    });

    const userMap = await batchLoadUsers([note.authorId]);
    const data = { ...note, author: userMap.get(note.authorId) ?? null };

    await invalidateCache("notes:*");

    const coupleId = authorCoupleId;
    if (coupleId) {
      triggerCoupleEvent(coupleId, 'DAILY_NOTES');
    }

    // Send email notification to partner (after response AND guaranteed —
    // plain fire-and-forget can be dropped when serverless freezes).
    if (coupleId) {
      const senderId = session.user.id;
      const senderName = session.user.name || "Pasangan";
      const noteId = note.id;
      const noteContent = note.content;
      after(async () => {
        try {
          const partnerMember = await prisma.coupleMember.findFirst({
            where: { coupleId, userId: { not: senderId } },
            include: { user: { select: { id: true, email: true, name: true } } },
          });

          const partner = partnerMember?.user;

          if (partner?.email) {
            const emailResult = await sendEmail({
              to: partner.email,
              subject: `\u{270D}\u{FE0F} Catatan Baru dari ${senderName}!`,
              html: noteNotificationHtml(
                senderName,
                noteContent,
                `${process.env.NEXTAUTH_URL}/notes`,
              ),
            });

            if (emailResult?.error) {
              // ponytail: no recipient PII in logs.
              console.error(
                `Failed to send note notification for note ${noteId}:`,
                emailResult.error,
              );
            }
          }
        } catch (error) {
          console.error("Failed to send note email notification:", error);
        }
      });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("Error creating note:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
