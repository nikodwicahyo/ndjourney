import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const ME = "cjld2cjxh0000qz8n0p3q4w5e1";
const PARTNER = "cjld2cjxh0000qz8n0p3q4w5e2";
const COUPLE = "couple-1";

const prismaMock = vi.hoisted(() => ({
  dailyLoveTaskEntry: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  withRateLimit: vi.fn(),
  rateLimitConfigs: { write: {} },
}));
vi.mock("@/lib/couple", () => ({ getUserCoupleId: vi.fn(async () => COUPLE) }));
vi.mock("@/lib/pusher-server", () => ({ triggerCoupleEvent: vi.fn(async () => {}) }));

const route = await import("@/app/api/daily-task/route");
const { auth } = await import("@/lib/auth");
const { withRateLimit } = await import("@/lib/rate-limit");
const { getUserCoupleId } = await import("@/lib/couple");
const { triggerCoupleEvent } = await import("@/lib/pusher-server");
const {
  DAILY_LOVE_TASKS,
  getDailyLoveTaskForDate,
  previousDayKey,
} = await import("@/lib/daily-love-task");
const { getJakartaToday } = await import("@/lib/date");

function allow(userId: string = ME) {
  vi.mocked(auth).mockResolvedValue({ user: { id: userId } } as never);
  vi.mocked(withRateLimit).mockResolvedValue({
    allowed: true,
    remaining: 99,
    session: { user: { id: userId } },
  } as never);
}

function putRequest(body: unknown) {
  return new Request("http://localhost/api/daily-task", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/daily-task", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allow();
    prismaMock.dailyLoveTaskEntry.findUnique.mockResolvedValue(null);
    prismaMock.dailyLoveTaskEntry.findMany.mockResolvedValue([]);
  });

  it("rejects anonymous callers", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await route.GET();
    expect(res.status).toBe(401);
  });

  it("returns the deterministic task and derives streak/history from completed rows", async () => {
    const today = getJakartaToday();
    const yesterday = previousDayKey(today);
    const yesterdayTask = DAILY_LOVE_TASKS[3];
    prismaMock.dailyLoveTaskEntry.findMany.mockResolvedValue([
      { task: yesterdayTask, date: new Date(`${yesterday}T00:00:00.000Z`) },
    ]);

    const res = await route.GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({
      date: today,
      task: getDailyLoveTaskForDate(today),
      done: false,
      streak: 1,
      history: [{ task: yesterdayTask, date: yesterday }],
    });
    expect(prismaMock.dailyLoveTaskEntry.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_date: { userId: ME, date: expect.any(Date) } },
      }),
    );
  });

  it("returns today's stored task and done flag", async () => {
    const today = getJakartaToday();
    const task = DAILY_LOVE_TASKS[7];
    prismaMock.dailyLoveTaskEntry.findUnique.mockResolvedValue({ task, done: true });
    prismaMock.dailyLoveTaskEntry.findMany.mockResolvedValue([
      { task, date: new Date(`${today}T00:00:00.000Z`) },
    ]);

    const res = await route.GET();
    const body = await res.json();
    expect(body).toMatchObject({ date: today, task, done: true, streak: 1 });
  });
});

describe("PUT /api/daily-task", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allow();
    prismaMock.dailyLoveTaskEntry.findUnique.mockResolvedValue(null);
    prismaMock.dailyLoveTaskEntry.findMany.mockResolvedValue([]);
    prismaMock.dailyLoveTaskEntry.upsert.mockResolvedValue({});
  });

  it("upserts the caller's per-user row and broadcasts DAILY_TASK", async () => {
    const today = getJakartaToday();
    const task = DAILY_LOVE_TASKS[5];
    prismaMock.dailyLoveTaskEntry.findUnique.mockResolvedValue({ task, done: true });
    prismaMock.dailyLoveTaskEntry.findMany.mockResolvedValue([
      { task, date: new Date(`${today}T00:00:00.000Z`) },
    ]);

    const res = await route.PUT(putRequest({ date: today, task, done: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ date: today, task, done: true, streak: 1 });

    const upsert = prismaMock.dailyLoveTaskEntry.upsert.mock.calls[0][0];
    expect(upsert.where).toEqual({
      userId_date: { userId: ME, date: expect.any(Date) },
    });
    expect(upsert.create).toMatchObject({ userId: ME, task, done: true });
    expect(upsert.create.completedAt).toBeInstanceOf(Date);
    expect(upsert.update.completedAt).toBeInstanceOf(Date);
    expect(triggerCoupleEvent).toHaveBeenCalledWith(COUPLE, "DAILY_TASK");
  });

  it("writes only the authenticated user's row", async () => {
    allow(PARTNER);
    const today = getJakartaToday();
    const res = await route.PUT(
      putRequest({ date: today, task: DAILY_LOVE_TASKS[1], done: false }),
    );
    expect(res.status).toBe(200);
    expect(prismaMock.dailyLoveTaskEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_date: { userId: PARTNER, date: expect.any(Date) } },
        create: expect.objectContaining({ userId: PARTNER }),
      }),
    );
  });

  it("clears completedAt when un-completing", async () => {
    const today = getJakartaToday();
    await route.PUT(putRequest({ date: today, task: DAILY_LOVE_TASKS[1], done: false }));
    const upsert = prismaMock.dailyLoveTaskEntry.upsert.mock.calls[0][0];
    expect(upsert.create.completedAt).toBeNull();
    expect(upsert.update.completedAt).toBeNull();
  });

  it("rejects unknown tasks and malformed bodies", async () => {
    const today = getJakartaToday();
    const unknown = await route.PUT(
      putRequest({ date: today, task: "Beli pulsa 100 ribu", done: true }),
    );
    expect(unknown.status).toBe(400);

    const malformed = await route.PUT(putRequest({ date: today, task: "", done: true }));
    expect(malformed.status).toBe(400);
    expect(prismaMock.dailyLoveTaskEntry.upsert).not.toHaveBeenCalled();
  });

  it("refuses to write across a day boundary", async () => {
    const today = getJakartaToday();
    const res = await route.PUT(
      putRequest({ date: previousDayKey(today), task: DAILY_LOVE_TASKS[0], done: true }),
    );
    expect(res.status).toBe(409);
    expect(prismaMock.dailyLoveTaskEntry.upsert).not.toHaveBeenCalled();
  });

  it("honours the write rate limit", async () => {
    vi.mocked(withRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      response: NextResponse.json({ error: "Terlalu banyak permintaan" }, { status: 429 }),
    } as never);
    const res = await route.PUT(
      putRequest({ date: getJakartaToday(), task: DAILY_LOVE_TASKS[0], done: true }),
    );
    expect(res.status).toBe(429);
    expect(prismaMock.dailyLoveTaskEntry.upsert).not.toHaveBeenCalled();
  });

  it("skips realtime for users without a couple", async () => {
    vi.mocked(getUserCoupleId).mockResolvedValueOnce(null);
    await route.PUT(
      putRequest({ date: getJakartaToday(), task: DAILY_LOVE_TASKS[0], done: true }),
    );
    expect(triggerCoupleEvent).not.toHaveBeenCalled();
  });
});
