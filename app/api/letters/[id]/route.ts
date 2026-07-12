import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getCached, setCached, cacheKey, invalidateCache } from "@/lib/redis";
import { batchLoadUsers } from "@/lib/batch";


const CACHE_TTL = 120;

export async function GET(
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
      select: {
        id: true,
        title: true,
        content: true,
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
    });

    if (!letter) {
      return NextResponse.json({ error: "Letter not found" }, { status: 404 });
    }

    if (
      letter.recipientId !== session.user.id &&
      letter.authorId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const userMap = await batchLoadUsers([letter.authorId, letter.recipientId]);

    const enriched = {
      ...letter,
      author: userMap.get(letter.authorId) ?? null,
      recipient: userMap.get(letter.recipientId) ?? null,
    };

    const isLocked =
      letter.isTimeCapsule &&
      letter.unlockAt !== null &&
      letter.unlockAt > new Date() &&
      !letter.isOpened;

    const lockBucket = isLocked ? "locked" : "unlocked";
    const cacheK = cacheKey("letters", "detail", session.user.id, lockBucket, id);

    const cached = await getCached<unknown>(cacheK);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "private, s-maxage=120, stale-while-revalidate=300" },
      });
    }

    if (isLocked) {
      const partial = {
        data: {
          id: enriched.id,
          title: enriched.title,
          isTimeCapsule: true,
          unlockAt: enriched.unlockAt,
          author: enriched.author,
          mood: enriched.mood,
          createdAt: enriched.createdAt,
        },
      };
      await setCached(cacheK, partial, CACHE_TTL);
      return NextResponse.json(partial, {
        headers: { "Cache-Control": "private, s-maxage=60, stale-while-revalidate=120" },
      });
    }

    const response = { data: enriched };
    await setCached(cacheK, response, CACHE_TTL);

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, s-maxage=120, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("Error fetching letter:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
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
      select: { id: true, authorId: true },
    });

    if (!letter) {
      return NextResponse.json({ error: "Letter not found" }, { status: 404 });
    }

    if (letter.authorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.letter.delete({ where: { id } });

    await invalidateCache("letters:*");

    return NextResponse.json({ message: "Letter deleted" });
  } catch (error) {
    console.error("Error deleting letter:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
