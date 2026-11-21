import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getUserCoupleId } from "@/lib/couple";
import { triggerCoupleEvent } from "@/lib/pusher-server";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { batchLocationSchema } from "@/lib/validations/location";
import {
  writeLocationFixes,
  toFixInput,
  isReonlineMoment,
} from "@/lib/location-write";
import { notifyLocationReonline } from "@/lib/activity";

export const dynamic = "force-dynamic";

class SharingDisabledError extends Error {}

// The shared rate limiter counts requests, not fixes. A batch carries up to
// 100 fixes, so cap the fix volume too. ponytail: per-instance in-memory
// budget; Redis remains authoritative when available. Add a shared store if
// abuse is observed across many serverless instances.
const FIX_BUDGET_PER_HOUR = 5_000;
const fixBudget = new Map<string, { count: number; resetAt: number }>();

function allowFixBudget(userId: string, count: number): boolean {
  const now = Date.now();
  const entry = fixBudget.get(userId);
  if (!entry || entry.resetAt <= now) {
    if (fixBudget.size > 1_000) fixBudget.clear();
    fixBudget.set(userId, { count, resetAt: now + 60 * 60_000 });
    return true;
  }
  if (entry.count + count > FIX_BUDGET_PER_HOUR) return false;
  entry.count += count;
  return true;
}

/**
 * Offline catch-up. One request for up to 100 queued fixes, one transaction,
 * one realtime event. The device timestamps are preserved, so the trail lands
 * in the past where it belongs and the live marker never moves backwards.
 */
export async function POST(request: Request) {
  try {
    const rateCheck = await withRateLimit(request, rateLimitConfigs.location);
    if (!rateCheck.allowed) {
      return rateCheck.response;
    }

    const userId = rateCheck.session.user.id;
    const coupleId = await getUserCoupleId(userId);
    if (!coupleId) {
      return NextResponse.json(
        { error: "Pasangan belum ditemukan" },
        { status: 404 },
      );
    }

    const share = await prisma.locationShare.findUnique({
      where: { userId },
      select: { isSharing: true },
    });
    if (!share?.isSharing) {
      return NextResponse.json(
        { error: "Kamu belum mengaktifkan berbagi lokasi" },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => null);
    if (body == null) {
      return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
    }
    const parsed = batchLocationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data lokasi tidak valid" },
        { status: 400 },
      );
    }

    const now = new Date();
    const fixes = parsed.data.fixes.map((fix) => toFixInput(fix, now));
    if (!allowFixBudget(userId, fixes.length)) {
      return NextResponse.json(
        { error: "Terlalu banyak titik lokasi. Coba lagi nanti." },
        { status: 429, headers: { "Retry-After": "3600" } },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const currentShare = await tx.locationShare.findUnique({
        where: { userId },
        select: { isSharing: true },
      });
      if (!currentShare?.isSharing) throw new SharingDisabledError();

      return writeLocationFixes(tx, { userId, coupleId, fixes });
    });

    if (result.applied) {
      // Await before returning: serverless freezes the invocation after the
      // response, so a fire-and-forget Pusher call can be dropped entirely.
      await triggerCoupleEvent(coupleId, "LOCATION");
    }

    if (
      result.applied &&
      isReonlineMoment(result.previousRecordedAt, result.lastRecordedAt, now)
    ) {
      await notifyLocationReonline(
        coupleId,
        userId,
        rateCheck.session.user.name ?? null,
        result.previousRecordedAt,
      );
    }

    return NextResponse.json({
      data: {
        ok: true,
        applied: result.applied,
        historyWritten: result.historyWritten,
      },
    });
  } catch (error) {
    if (error instanceof SharingDisabledError) {
      return NextResponse.json(
        { error: "Kamu belum mengaktifkan berbagi lokasi" },
        { status: 403 },
      );
    }
    console.error("Error updating location batch:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
