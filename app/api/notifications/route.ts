import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { batchLoadUsers } from "@/lib/batch";
import { getUserCoupleId } from "@/lib/couple";
import type { NotificationItem, NotificationsResponse } from "@/types/index";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const me = session.user.id;
    const [coupleId, member] = await Promise.all([
      getUserCoupleId(me),
      prisma.coupleMember.findUnique({
        where: { userId: me },
        select: { lastSeenActivityAt: true },
      }),
    ]);

    if (!coupleId || !member) {
      return NextResponse.json({ items: [], unreadCount: 0, nextCursor: null });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit")) || DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const cursor = searchParams.get("cursor") ?? null;

    // cursor is an event id: resolve its createdAt, then page before it.
    // ponytail: ties on createdAt (same-millisecond writes) can skip an item
    // at a page boundary — upgrade to a compound (createdAt, id) cursor if that
    // ever matters; activity events are human-paced, so sub-second ties are rare.
    let cursorCreatedAt: Date | null = null;
    if (cursor) {
      const cursorEvent = await prisma.activityEvent.findUnique({
        where: { id: cursor },
        select: { createdAt: true },
      });
      cursorCreatedAt = cursorEvent?.createdAt ?? null;
    }

    const lastSeen = member.lastSeenActivityAt;
    const listWhere: Record<string, unknown> = {
      coupleId,
      actorId: { not: me },
    };
    if (cursorCreatedAt) {
      listWhere.createdAt = { lt: cursorCreatedAt };
    }
    const countWhere: Record<string, unknown> = {
      coupleId,
      actorId: { not: me },
    };
    if (lastSeen) {
      countWhere.createdAt = { gt: lastSeen };
    }

    const [rows, unreadCount] = await Promise.all([
      prisma.activityEvent.findMany({
        where: listWhere,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        select: {
          id: true,
          type: true,
          action: true,
          title: true,
          body: true,
          href: true,
          createdAt: true,
          actorId: true,
        },
      }),
      prisma.activityEvent.count({ where: countWhere }),
    ]);

    const userMap = await batchLoadUsers(rows.map((r) => r.actorId));

    const items: NotificationItem[] = rows.slice(0, limit).map((row) => ({
      id: row.id,
      type: row.type,
      action: row.action,
      title: row.title,
      body: row.body,
      href: row.href,
      createdAt: row.createdAt.toISOString(),
      actor: userMap.get(row.actorId) ?? { id: "", name: null, image: null },
      unread: !lastSeen || row.createdAt > lastSeen,
    }));

    const nextCursor = rows.length > limit ? rows[limit - 1].id : null;

    return NextResponse.json<NotificationsResponse>({ items, unreadCount, nextCursor });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
