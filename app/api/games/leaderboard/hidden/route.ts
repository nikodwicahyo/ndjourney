import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  hideLeaderboardPlayerSchema,
  unhideLeaderboardPlayerSchema,
} from "@/lib/validations/game";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { invalidateCache } from "@/lib/redis";
import { triggerCoupleEvent } from "@/lib/pusher-server";
import { leaderboardPlayerKey } from "@/lib/games/leaderboard-key";
import { auth } from "@/lib/auth";
import { getUserCoupleId } from "@/lib/couple";

/**
 * Leaderboard moderation: the players a couple member hid from every board tab.
 *
 * Hiding never deletes ledger rows (`GameRound` / `GameArcadeScore`) — the
 * aggregate query filters against this list, so the action is reversible and
 * the history stays intact. Both the dashboard and the public board read the
 * same aggregates, so a hide applies everywhere.
 */

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Moderation data — couple members only (same gate as the question bank).
    if (!(await getUserCoupleId(session.user.id))) {
      return NextResponse.json({ error: "Pasangan belum ditemukan" }, { status: 403 });
    }

    const rows = await prisma.hiddenLeaderboardPlayer.findMany({
      orderBy: { hiddenAt: "desc" },
      select: { playerKey: true, label: true, hiddenAt: true },
    });

    return NextResponse.json({ data: rows }, { headers: NO_STORE });
  } catch (error) {
    console.error("Error fetching hidden leaderboard players:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const rateCheck = await withRateLimit(request, rateLimitConfigs.write);
    if (!rateCheck.allowed) return rateCheck.response;

    const coupleId = await getUserCoupleId(rateCheck.session.user.id);
    if (!coupleId) {
      return NextResponse.json({ error: "Pasangan belum ditemukan" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (body == null) {
      return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
    }
    const parsed = hideLeaderboardPlayerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validasi gagal" },
        { status: 400 },
      );
    }

    const playerKey = leaderboardPlayerKey(parsed.data);
    if (!playerKey) {
      return NextResponse.json({ error: "Identitas pemain tidak valid" }, { status: 400 });
    }

    // Label is cosmetic and derived here: a renamed account shows its current
    // name, and the client never supplies display text.
    const label = parsed.data.userId
      ? (await prisma.user.findUnique({
          where: { id: parsed.data.userId },
          select: { name: true },
        }))?.name?.trim() || "Pasangan"
      : parsed.data.playerName!.trim();

    const row = await prisma.hiddenLeaderboardPlayer.upsert({
      where: { playerKey },
      create: { playerKey, label, hiddenBy: rateCheck.session.user.id },
      update: { label, hiddenBy: rateCheck.session.user.id },
      select: { playerKey: true, label: true, hiddenAt: true },
    });

    // Every leaderboard tab (and the arcade panel) is cached per type.
    await invalidateCache("games:*");
    // Push after the cache drop so a partner's refetch already sees the change.
    await triggerCoupleEvent(coupleId, "GAMES_LEADERBOARD");

    return NextResponse.json({ data: row }, { headers: NO_STORE });
  } catch (error) {
    console.error("Error hiding leaderboard player:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const rateCheck = await withRateLimit(request, rateLimitConfigs.write);
    if (!rateCheck.allowed) return rateCheck.response;

    const coupleId = await getUserCoupleId(rateCheck.session.user.id);
    if (!coupleId) {
      return NextResponse.json({ error: "Pasangan belum ditemukan" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (body == null) {
      return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
    }
    const parsed = unhideLeaderboardPlayerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validasi gagal" },
        { status: 400 },
      );
    }

    // Idempotent: restoring an already-restored player is not an error.
    const { count } = await prisma.hiddenLeaderboardPlayer.deleteMany({
      where: { playerKey: parsed.data.playerKey },
    });

    await invalidateCache("games:*");
    await triggerCoupleEvent(coupleId, "GAMES_LEADERBOARD");

    return NextResponse.json({ removed: count }, { headers: NO_STORE });
  } catch (error) {
    console.error("Error restoring leaderboard player:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
