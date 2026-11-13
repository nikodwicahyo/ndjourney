import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { getJakartaToday } from "@/lib/date";
import { getUserCoupleId } from "@/lib/couple";
import { triggerCoupleEvent } from "@/lib/pusher-server";
import { dailyLoveTaskUpdateSchema } from "@/lib/validations/daily-love-task";
import {
  getDailyLoveTaskForDate,
  getLoveTaskHistory,
  getLoveTaskStreak,
  isDailyLoveTask,
  type DailyLoveTaskHistoryEntry,
  type DailyLoveTaskState,
} from "@/lib/daily-love-task";

// Streak + history read model. There is at most one row per day, and
// getLoveTaskHistory dedupes to one entry per task (the bank size), so the
// response stays bounded no matter how many years the account lives.

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

function dayKeyToDbDate(dayKey: string): Date {
  // `@db.Date` is date-only; UTC midnight is the canonical, DST-free encoding.
  return new Date(`${dayKey}T00:00:00.000Z`);
}

function dbDateToDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Single source of the per-user read model for GET and the PUT response.
 * Streak and history are derived from completed rows, never stored twice.
 */
async function loadState(userId: string, todayKey: string): Promise<DailyLoveTaskState> {
  const [todayEntry, doneRows] = await Promise.all([
    prisma.dailyLoveTaskEntry.findUnique({
      where: { userId_date: { userId, date: dayKeyToDbDate(todayKey) } },
      select: { task: true, done: true },
    }),
    // Every completed day, newest first: one row per day, deduped to ≤365
    // entries by getLoveTaskHistory below. Deliberately unbounded so a task can
    // never fall out of the window and be treated as "unseen" again — the
    // selection query is cheap (indexed, two small columns, ~365 rows/year).
    prisma.dailyLoveTaskEntry.findMany({
      where: { userId, done: true },
      orderBy: { date: "desc" },
      select: { task: true, date: true },
    }),
  ]);

  const completed: DailyLoveTaskHistoryEntry[] = doneRows.map((row) => ({
    task: row.task,
    date: dbDateToDayKey(row.date),
  }));

  return {
    date: todayKey,
    task: todayEntry?.task ?? getDailyLoveTaskForDate(todayKey),
    done: todayEntry?.done ?? false,
    streak: getLoveTaskStreak(completed.map((entry) => entry.date), todayKey),
    history: getLoveTaskHistory(completed),
  };
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const state = await loadState(session.user.id, getJakartaToday());
    return NextResponse.json(state, { headers: NO_STORE });
  } catch (error) {
    console.error("Error fetching daily love task:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const rateCheck = await withRateLimit(request, rateLimitConfigs.write);
    if (!rateCheck.allowed) {
      return rateCheck.response;
    }
    const userId = rateCheck.session.user.id;

    const body = await request.json().catch(() => null);
    if (body == null) {
      return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
    }
    const parsed = dailyLoveTaskUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data tugas tidak valid" },
        { status: 400 },
      );
    }

    const todayKey = getJakartaToday();
    if (parsed.data.date !== todayKey) {
      // The tab rendered a different day than the server is on (open past
      // midnight, or a skewed device clock). Never write across day boundaries;
      // let the client refetch instead.
      return NextResponse.json(
        { error: "Tanggal tugas sudah berganti. Muat ulang halaman.", date: todayKey },
        { status: 409 },
      );
    }

    if (!isDailyLoveTask(parsed.data.task)) {
      return NextResponse.json({ error: "Tugas tidak dikenali" }, { status: 400 });
    }

    const date = dayKeyToDbDate(todayKey);
    const done = parsed.data.done;
    const completedAt = done ? new Date() : null;

    await prisma.dailyLoveTaskEntry.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, task: parsed.data.task, done, completedAt },
      update: { task: parsed.data.task, done, completedAt },
    });

    const state = await loadState(userId, todayKey);

    // Realtime: both partners' devices (and the user's other devices) share the
    // couple channel, so an invalidate makes every open card refetch. Failure is
    // swallowed inside triggerCoupleEvent — the write already succeeded.
    const coupleId = await getUserCoupleId(userId);
    if (coupleId) {
      await triggerCoupleEvent(coupleId, "DAILY_TASK");
    }

    return NextResponse.json(state, { headers: NO_STORE });
  } catch (error) {
    console.error("Error updating daily love task:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
