import { describe, it, expect, vi, beforeEach } from "vitest";

const me = "user-me";
const partner = "user-partner";
const coupleId = "couple-1";
const lastSeen = new Date("2026-10-30T10:00:00Z");

const partnerActor = { id: partner, name: "Partner", image: null };

const e1 = {
  id: "evt-1",
  coupleId,
  actorId: partner,
  type: "photo",
  action: "added",
  title: "New photo",
  body: null,
  href: null,
  createdAt: new Date("2026-11-01T09:00:00Z"),
};
const e2 = {
  id: "evt-2",
  coupleId,
  actorId: partner,
  type: "letter",
  action: "sent",
  title: "A letter",
  body: "x",
  href: "/letters/1",
  createdAt: new Date("2026-10-31T09:00:00Z"),
};
const e3 = {
  id: "evt-3",
  coupleId,
  actorId: partner,
  type: "milestone",
  action: "created",
  title: "Milestone",
  body: null,
  href: null,
  createdAt: new Date("2026-10-29T09:00:00Z"),
};

const prismaMock = vi.hoisted(() => ({
  activityEvent: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
  },
  coupleMember: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/batch", () => ({
  batchLoadUsers: vi.fn(async (ids: string[]) =>
    new Map(
      ids.map((id) => [id, { id, name: id === partner ? "Partner" : null, image: null }]),
    ),
  ),
}));
vi.mock("@/lib/couple", () => ({ getUserCoupleId: vi.fn(async () => coupleId) }));

const { auth } = await import("@/lib/auth");
const { GET: getNotifications } = await import("@/app/api/notifications/route");
const { POST: postSeen } = await import("@/app/api/notifications/seen/route");

describe("notifications API (GET /api/notifications, POST /api/notifications/seen)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: me } } as never);
    vi.mocked(prismaMock.coupleMember.findUnique).mockResolvedValue({
      coupleId,
      lastSeenActivityAt: lastSeen,
    });
  });

  it("N-01: unauthenticated GET → 401", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await getNotifications(new Request("http://localhost/api/notifications"));
    expect(res.status).toBe(401);
    expect(prismaMock.activityEvent.findMany).not.toHaveBeenCalled();
  });

  it("N-02: couple-scoped list, partner-authored only, unread flags + unreadCount", async () => {
    vi.mocked(prismaMock.activityEvent.findMany).mockResolvedValue([e1, e2, e3]);
    vi.mocked(prismaMock.activityEvent.count).mockResolvedValue(2);

    const res = await getNotifications(new Request("http://localhost/api/notifications?limit=20"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.unreadCount).toBe(2);
    expect(body.items).toHaveLength(3);
    expect(body.items.map((i: { id: string }) => i.id)).toEqual(["evt-1", "evt-2", "evt-3"]);
    expect(body.items[0].unread).toBe(true);
    expect(body.items[1].unread).toBe(true);
    expect(body.items[2].unread).toBe(false);
    expect(body.items[0].actor).toEqual(partnerActor);
    expect(body.items[0].createdAt).toBe("2026-11-01T09:00:00.000Z");
    expect(body.nextCursor).toBeNull();
    expect(prismaMock.activityEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ coupleId, actorId: { not: me } }),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 21,
      }),
    );
    // own events never appear in the bell
    expect(body.items.find((i: { id: string }) => i.id === "evt-own")).toBeUndefined();
  });

  it("N-03: cursor page 2 returns the next page without overlap", async () => {
    vi.mocked(prismaMock.activityEvent.findMany)
      .mockResolvedValueOnce([e1, e2, e3])
      .mockResolvedValueOnce([e3])
      .mockResolvedValue([]);
    vi.mocked(prismaMock.activityEvent.findUnique).mockResolvedValue({
      createdAt: e2.createdAt,
    });
    vi.mocked(prismaMock.activityEvent.count).mockResolvedValue(2);

    const page1 = await getNotifications(new Request("http://localhost/api/notifications?limit=2"));
    expect(page1.status).toBe(200);
    const b1 = await page1.json();
    expect(b1.items.map((i: { id: string }) => i.id)).toEqual(["evt-1", "evt-2"]);
    expect(b1.nextCursor).toBe("evt-2");

    const page2 = await getNotifications(
      new Request(`http://localhost/api/notifications?limit=2&cursor=${b1.nextCursor}`),
    );
    expect(page2.status).toBe(200);
    const b2 = await page2.json();
    expect(b2.items.map((i: { id: string }) => i.id)).toEqual(["evt-3"]);
    expect(b2.nextCursor).toBeNull();

    const page2Where = (prismaMock.activityEvent.findMany as any).mock.calls[1]?.[0]?.where;
    expect(page2Where.createdAt).toEqual({ lt: e2.createdAt });
    expect(
      b1.items.some((i: { id: string }) => b2.items.some((j: { id: string }) => j.id === i.id)),
    ).toBe(false);
  });

  it("N-04: POST seen stamps lastSeenActivityAt; following GET reports unreadCount 0", async () => {
    vi.mocked(prismaMock.coupleMember.update).mockResolvedValue({
      id: "m-1",
      coupleId,
      userId: me,
    });

    const seen = await postSeen(
      new Request("http://localhost/api/notifications/seen", { method: "POST" }),
    );
    expect(seen.status).toBe(200);
    expect(await seen.json()).toEqual({ ok: true });
    expect(prismaMock.coupleMember.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: me },
        data: { lastSeenActivityAt: expect.any(Date) },
      }),
    );

    vi.mocked(prismaMock.coupleMember.findUnique).mockResolvedValue({
      coupleId,
      lastSeenActivityAt: new Date("2099-01-01T00:00:00Z"),
    });
    vi.mocked(prismaMock.activityEvent.findMany).mockResolvedValue([]);
    vi.mocked(prismaMock.activityEvent.count).mockResolvedValue(0);

    const res = await getNotifications(new Request("http://localhost/api/notifications"));
    const body = await res.json();
    expect(body.unreadCount).toBe(0);
    expect(body.items).toEqual([]);
  });

  it("N-05: unauthenticated POST seen → 401", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await postSeen(
      new Request("http://localhost/api/notifications/seen", { method: "POST" }),
    );
    expect(res.status).toBe(401);
    expect(prismaMock.coupleMember.update).not.toHaveBeenCalled();
  });
});
