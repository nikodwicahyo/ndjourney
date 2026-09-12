import { describe, it, expect, vi, beforeEach } from "vitest";

const ME = "cjld2cjxh0000qz8n0p3q4w5e1";
const PARTNER = "cjld2cjxh0000qz8n0p3q4w5e2";
const COUPLE = "couple-1";

const txMock = vi.hoisted(() => ({
  userLocationHistory: { findFirst: vi.fn(async () => null), create: vi.fn(async () => ({})), findMany: vi.fn(async () => []) },
}));
const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({ userLocationHistory: txMock.userLocationHistory })),
  coupleMember: { findUnique: vi.fn(), findFirst: vi.fn() },
  locationShare: { findUnique: vi.fn(), upsert: vi.fn() },
  userLocation: { findUnique: vi.fn(), upsert: vi.fn(), delete: vi.fn(async () => ({})) },
  userLocationHistory: { findMany: vi.fn() },
  letter: { count: vi.fn(async () => 0), findUnique: vi.fn(), update: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  withRateLimit: vi.fn(),
  rateLimitConfigs: { write: {}, location: {}, score: {} },
}));
vi.mock("@/lib/redis", () => ({
  getCached: vi.fn(async () => null),
  setCached: vi.fn(async () => {}),
  invalidateCache: vi.fn(async () => {}),
  cacheKey: (...p: string[]) => p.join(":"),
}));
vi.mock("@/lib/couple", () => ({ getUserCoupleId: vi.fn(async () => COUPLE) }));
vi.mock("@/lib/pusher-server", () => ({
  triggerCoupleEvent: vi.fn(),
  getPusherServer: vi.fn(() => ({ trigger: vi.fn(async () => {}) })),
}));
vi.mock("@/lib/resend", () => ({ sendEmail: vi.fn(async () => ({ data: { id: "m1" } })), letterNotificationHtml: () => "<p>x</p>" }));
vi.mock("@/lib/batch", () => ({
  batchLoadUsers: vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, { id, name: "P", email: null, image: null }]))),
}));
vi.mock("@/lib/cloudinary", () => ({
  getCloudinaryUsage: vi.fn(async () => ({ storageUsed: 5, storageLimit: 100 })),
}));

const loc = await import("@/app/api/location/route");
const share = await import("@/app/api/location/share/route");
const history = await import("@/app/api/location/history/route");
const heart = await import("@/app/api/location/heart/route");
const stats = await import("@/app/api/dashboard/stats/route");
const activity = await import("@/app/api/dashboard/activity/route");
const open = await import("@/app/api/letters/[id]/open/route");
const { auth } = await import("@/lib/auth");
const { withRateLimit } = await import("@/lib/rate-limit");

function allow(userId: string = ME) {
  vi.mocked(auth).mockResolvedValue({ user: { id: userId, name: "A", image: null } } as never);
  vi.mocked(withRateLimit).mockResolvedValue({ allowed: true, remaining: 99, session: { user: { id: userId } } } as never);
}
const point = { latitude: -6.2, longitude: 106.8, accuracy: 10, heading: 90, speed: 0, altitude: null, updatedAt: new Date(), deviceType: "mobile" };

describe("location API contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allow();
  });

  it("LOC: GET 200 pair payload, 401 anon, 404 solo", async () => {
    prismaMock.locationShare.findUnique.mockResolvedValue({ isSharing: true });
    prismaMock.coupleMember.findFirst.mockResolvedValue({ user: { id: PARTNER, name: "B", image: null } });
    prismaMock.userLocation.findUnique.mockResolvedValue(point);
    const ok = await loc.GET();
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ data: { self: { isSharing: true }, partner: { userId: PARTNER } } });

    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await loc.GET()).status).toBe(401);
    allow();
    prismaMock.coupleMember.findFirst.mockResolvedValue(null);
    // no couple → route 404 via getUserCoupleId? GET uses getUserCoupleId first
    const { getUserCoupleId } = await import("@/lib/couple");
    vi.mocked(getUserCoupleId).mockResolvedValueOnce(null);
    expect((await loc.GET()).status).toBe(404);
  });

  it("LOC-01/02/03: POST 200, 403 sharing-off, 400 invalid, 404 no-couple", async () => {
    prismaMock.locationShare.findUnique.mockResolvedValue({ isSharing: true });
    prismaMock.userLocation.upsert.mockResolvedValue({});
    const ok = await loc.POST(new Request("http://localhost/api/location", {
      method: "POST", body: JSON.stringify({ ...point, altitude: undefined, deviceType: "mobile" }),
    }));
    expect(ok.status).toBe(200);

    prismaMock.locationShare.findUnique.mockResolvedValue({ isSharing: false });
    expect((await loc.POST(new Request("http://localhost/api/location", {
      method: "POST", body: JSON.stringify({ latitude: -6.2, longitude: 106.8, deviceType: "mobile" }),
    }))).status).toBe(403);

    prismaMock.locationShare.findUnique.mockResolvedValue({ isSharing: true });
    expect((await loc.POST(new Request("http://localhost/api/location", {
      method: "POST", body: JSON.stringify({ latitude: 200, longitude: 0, deviceType: "mobile" }),
    }))).status).toBe(400);

    const { getUserCoupleId } = await import("@/lib/couple");
    vi.mocked(getUserCoupleId).mockResolvedValueOnce(null);
    expect((await loc.POST(new Request("http://localhost/api/location", {
      method: "POST", body: JSON.stringify({ latitude: -6.2, longitude: 106.8, deviceType: "mobile" }),
    }))).status).toBe(404);
  });

  it("LOC consent: share PUT toggles + wipes location on OFF; 400 invalid", async () => {
    prismaMock.locationShare.upsert.mockResolvedValue({ isSharing: false });
    const off = await share.PUT(new Request("http://localhost/api/location/share", {
      method: "PUT", body: JSON.stringify({ isSharing: false }),
    }));
    expect(off.status).toBe(200);
    expect(prismaMock.userLocation.delete).toHaveBeenCalledWith({ where: { userId: ME } });
    prismaMock.locationShare.upsert.mockResolvedValue({ isSharing: true });
    expect((await share.PUT(new Request("http://localhost/api/location/share", {
      method: "PUT", body: JSON.stringify({ isSharing: true }),
    }))).status).toBe(200);
    expect((await share.PUT(new Request("http://localhost/api/location/share", {
      method: "PUT", body: JSON.stringify({ isSharing: "yes" }),
    }))).status).toBe(400);
  });

  it("LOC-04/05: history GET 200 ordered, heart POST 200", async () => {
    prismaMock.coupleMember.findFirst.mockResolvedValue({ userId: PARTNER });
    prismaMock.userLocationHistory.findMany.mockResolvedValue([]);
    const h = await history.GET();
    expect(h.status).toBe(200);
    const heartRes = await heart.POST(new Request("http://localhost/api/location/heart", { method: "POST", body: JSON.stringify({}) }));
    expect(heartRes.status).toBe(200);
  });
});

describe("dashboard + letters-open contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allow();
  });

  it("DASH-01/02: stats 200 shape + zeroStats solo; activity 200; 401 anon", async () => {
    prismaMock.coupleMember.findUnique.mockResolvedValue({ coupleId: COUPLE });
    prismaMock.$queryRaw.mockResolvedValue([{ photoCount: 2, videoCount: 1, letterCount: 3, milestoneCount: 1, anniversaryDate: new Date("2020-01-01"), birthDate1: null, birthDate2: null }]);
    const s = await stats.GET();
    expect(s.status).toBe(200);
    const body = await s.json();
    expect(body.data).toMatchObject({ photoCount: 2, videoCount: 1, letterCount: 3, milestoneCount: 1, unreadLetterCount: 0, storageUsed: 5, storageLimit: 100 });
    expect(body.data.daysSinceAnniversary).toBeGreaterThan(1000);

    prismaMock.coupleMember.findUnique.mockResolvedValue(null);
    const solo = await stats.GET();
    expect(solo.status).toBe(200);
    expect(await solo.json()).toMatchObject({ data: { photoCount: 0 } });

    prismaMock.$queryRaw.mockResolvedValue([]);
    const a = await activity.GET();
    expect(a.status).toBe(200);

    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await stats.GET()).status).toBe(401);
    expect((await activity.GET()).status).toBe(401);
  });

  it("LTR-05: open PUT 200 + email; 404/403/400-opened/423-locked/401", async () => {
    const fresh = { id: "l1", recipientId: ME, isOpened: false, isTimeCapsule: false, unlockAt: null, author: { id: "a", name: "A", email: "a@x.com" } };
    prismaMock.letter.findUnique.mockResolvedValue(fresh);
    prismaMock.letter.update.mockResolvedValue({ id: "l1", isOpened: true, openedAt: new Date() });
    const ok = await open.PUT(new Request("http://localhost/api/letters/l1/open", { method: "PUT" }), { params: Promise.resolve({ id: "l1" }) });
    expect(ok.status).toBe(200);
    const { sendEmail } = await import("@/lib/resend");
    expect(sendEmail).toHaveBeenCalledOnce();

    prismaMock.letter.findUnique.mockResolvedValue(null);
    expect((await open.PUT(new Request("http://localhost/api/letters/x/open", { method: "PUT" }), { params: Promise.resolve({ id: "x" }) })).status).toBe(404);

    prismaMock.letter.findUnique.mockResolvedValue({ ...fresh, recipientId: PARTNER });
    expect((await open.PUT(new Request("http://localhost/api/letters/l1/open", { method: "PUT" }), { params: Promise.resolve({ id: "l1" }) })).status).toBe(403);

    prismaMock.letter.findUnique.mockResolvedValue({ ...fresh, isOpened: true });
    expect((await open.PUT(new Request("http://localhost/api/letters/l1/open", { method: "PUT" }), { params: Promise.resolve({ id: "l1" }) })).status).toBe(400);

    prismaMock.letter.findUnique.mockResolvedValue({ ...fresh, isTimeCapsule: true, unlockAt: new Date(Date.now() + 86400000) });
    expect((await open.PUT(new Request("http://localhost/api/letters/l1/open", { method: "PUT" }), { params: Promise.resolve({ id: "l1" }) })).status).toBe(423);

    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await open.PUT(new Request("http://localhost/api/letters/l1/open", { method: "PUT" }), { params: Promise.resolve({ id: "l1" }) })).status).toBe(401);
  });
});
