import { describe, it, expect, vi, beforeEach } from "vitest";

const ME = "cjld2cjxh0000qz8n0p3q4w5e1";
const COUPLE = "couple-1";
const WID = "cjld2cjxh0000qz8n0p3q4w5ew";

const prismaMock = vi.hoisted(() => ({
  wishItem: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  photo: { findFirst: vi.fn(async (): Promise<{ id: string } | null> => null) },
  coupleConfig: { findFirst: vi.fn(), update: vi.fn() },
  coupleMember: { findUnique: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
  session: { findMany: vi.fn(async () => []) },
  dailyNote: { findUnique: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  withRateLimit: vi.fn(),
  rateLimitConfigs: { write: {}, note: {} },
}));
vi.mock("@/lib/redis", () => ({
  redis: { del: vi.fn(async () => 0) },
  getCached: vi.fn(async () => null),
  setCached: vi.fn(async () => {}),
  invalidateCache: vi.fn(async () => {}),
  cacheKey: (...p: string[]) => p.join(":"),
}));
vi.mock("@/lib/couple", () => ({ getUserCoupleId: vi.fn(async () => COUPLE) }));
vi.mock("@/lib/pusher-server", () => ({ triggerCoupleEvent: vi.fn() }));
vi.mock("@/lib/batch", () => ({
  invalidateUserCache: vi.fn(async () => {}),
  clearUserCache: vi.fn(),
}));
vi.mock("@/lib/cloudinary", () => ({
  deleteFromCloudinaryUrl: vi.fn(async () => {}),
  getCloudinaryUsage: vi.fn(async () => ({ used: 0, limit: 1 })),
}));

const wishes = await import("@/app/api/wishes/route");
const wishById = await import("@/app/api/wishes/[id]/route");
const couple = await import("@/app/api/couple/route");
const userRoute = await import("@/app/api/user/route");
const partner = await import("@/app/api/partner/route");
const noteById = await import("@/app/api/notes/[id]/route");
const { auth } = await import("@/lib/auth");
const { withRateLimit } = await import("@/lib/rate-limit");

function allow(userId: string = ME) {
  vi.mocked(auth).mockResolvedValue({ user: { id: userId } } as never);
  vi.mocked(withRateLimit).mockResolvedValue({ allowed: true, remaining: 99, session: { user: { id: userId } } } as never);
}

describe("wishes API contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allow();
  });

  it("WISH: GET public 200 with pagination", async () => {
    prismaMock.wishItem.findMany.mockResolvedValue([]);
    prismaMock.wishItem.count.mockResolvedValue(0);
    const res = await wishes.GET(new Request("http://localhost/api/wishes"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ total: 0, page: 1 });
  });

  it("WISH: POST 201 + 400 empty title + 400 bad link", async () => {
    prismaMock.wishItem.create.mockResolvedValue({ id: WID });
    const ok = await wishes.POST(new Request("http://localhost/api/wishes", {
      method: "POST", body: JSON.stringify({ title: "Bali", category: "TRAVEL" }),
    }));
    expect(ok.status).toBe(201);
    for (const body of [{ title: "" }, { title: "x", link: "javascript:alert(1)" }]) {
      const bad = await wishes.POST(new Request("http://localhost/api/wishes", { method: "POST", body: JSON.stringify(body) }));
      expect(bad.status).toBe(400);
    }
  });

  it("WISH-01: PUT mark-done sets doneAt; cross-couple 404; DELETE 200", async () => {
    prismaMock.wishItem.findUnique.mockResolvedValue({ coupleId: COUPLE });
    prismaMock.wishItem.update.mockResolvedValue({ id: WID, isDone: true });
    const done = await wishById.PUT(new Request("http://localhost/api/wishes/x", {
      method: "PUT", body: JSON.stringify({ isDone: true }),
    }), { params: Promise.resolve({ id: WID }) });
    expect(done.status).toBe(200);
    expect(prismaMock.wishItem.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ isDone: true, doneAt: expect.any(Date) }),
    }));

    prismaMock.wishItem.findUnique.mockResolvedValue({ coupleId: "couple-other" });
    const foreign = await wishById.PUT(new Request("http://localhost/api/wishes/x", {
      method: "PUT", body: JSON.stringify({ title: "y" }),
    }), { params: Promise.resolve({ id: WID }) });
    expect(foreign.status).toBe(404);

    prismaMock.wishItem.findUnique.mockResolvedValue({ coupleId: COUPLE, imageUrl: null });
    const del = await wishById.DELETE(new Request("http://localhost/api/wishes/x", { method: "DELETE" }), { params: Promise.resolve({ id: WID }) });
    expect(del.status).toBe(200);
    expect(prismaMock.wishItem.delete).toHaveBeenCalledWith({ where: { id: WID } });
  });
});

describe("couple / user / partner / notes-delete contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allow();
  });

  it("DASH-03: couple GET 200 + 404; PUT 200 + 403 no-couple + 400 bad date", async () => {
    prismaMock.coupleConfig.findFirst.mockResolvedValue({ id: "cfg", name1: "A" });
    const get = await couple.GET();
    expect(get.status).toBe(200);
    prismaMock.coupleConfig.findFirst.mockResolvedValue(null);
    expect((await couple.GET()).status).toBe(404);

    prismaMock.coupleConfig.findFirst.mockResolvedValue({ id: "cfg", heroPhotoUrl: null, backgroundMusicUrl: null });
    prismaMock.coupleConfig.update.mockResolvedValue({ id: "cfg" });
    const put = await couple.PUT(new Request("http://localhost/api/couple", {
      method: "PUT", body: JSON.stringify({ tagline: "Selamanya" }),
    }));
    expect(put.status).toBe(200);

    const { getUserCoupleId } = await import("@/lib/couple");
    vi.mocked(getUserCoupleId).mockResolvedValueOnce(null);
    const noc = await couple.PUT(new Request("http://localhost/api/couple", { method: "PUT", body: JSON.stringify({ tagline: "x" }) }));
    expect(noc.status).toBe(403);

    const bad = await couple.PUT(new Request("http://localhost/api/couple", { method: "PUT", body: JSON.stringify({ anniversaryDate: "99-99-99" }) }));
    expect(bad.status).toBe(400);
  });

  it("DASH-04: PUT heroCrop saved; invalid rect 400; gallery-referenced hero URL never deleted", async () => {
    const { deleteFromCloudinaryUrl } = await import("@/lib/cloudinary");
    prismaMock.coupleConfig.findFirst.mockResolvedValue({ id: "cfg", heroPhotoUrl: "https://old.example/h.jpg", backgroundMusicUrl: null });
    prismaMock.coupleConfig.update.mockImplementation(async (args: unknown) => ({ id: "cfg", heroPhotoUrl: "https://new.example/h.jpg" }));

    const badRect = await couple.PUT(new Request("http://localhost/api/couple", {
      method: "PUT", body: JSON.stringify({ heroPhotoUrl: "https://new.example/h.jpg", heroCrop: { x: 0, y: 0, w: 2, h: 1 } }),
    }));
    expect(badRect.status).toBe(400);

    prismaMock.photo.findFirst.mockResolvedValue({ id: "p1" });
    const ok = await couple.PUT(new Request("http://localhost/api/couple", {
      method: "PUT", body: JSON.stringify({ heroPhotoUrl: "https://new.example/h.jpg", heroCrop: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 } }),
    }));
    expect(ok.status).toBe(200);
    expect(prismaMock.coupleConfig.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ heroCrop: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 } }),
    }));
    expect(deleteFromCloudinaryUrl).not.toHaveBeenCalled();

    prismaMock.photo.findFirst.mockResolvedValue(null);
    await couple.PUT(new Request("http://localhost/api/couple", {
      method: "PUT", body: JSON.stringify({ heroPhotoUrl: "https://new.example/h.jpg" }),
    }));
    expect(deleteFromCloudinaryUrl).toHaveBeenCalledWith("https://old.example/h.jpg");
  });

  it("WISH-02: PUT imageCrop saved + cleared with image; gallery-referenced image never deleted", async () => {
    const { deleteFromCloudinaryUrl } = await import("@/lib/cloudinary");
    prismaMock.wishItem.findUnique.mockResolvedValue({ coupleId: COUPLE });
    prismaMock.wishItem.update.mockImplementation(async (args: unknown) => ({ id: WID, imageUrl: "https://new.example/w.jpg" }));
    const crop = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };

    const bad = await wishById.PUT(new Request("http://localhost/api/wishes/x", {
      method: "PUT", body: JSON.stringify({ imageCrop: { x: 0, y: 0, w: 5, h: 1 } }),
    }), { params: Promise.resolve({ id: WID }) });
    expect(bad.status).toBe(400);

    prismaMock.photo.findFirst.mockResolvedValue({ id: "p1" });
    prismaMock.wishItem.findUnique.mockResolvedValueOnce({ coupleId: COUPLE })
      .mockResolvedValueOnce({ coupleId: COUPLE, imageUrl: "https://old.example/w.jpg" });
    const ok = await wishById.PUT(new Request("http://localhost/api/wishes/x", {
      method: "PUT", body: JSON.stringify({ imageUrl: "https://new.example/w.jpg", imageCrop: crop }),
    }), { params: Promise.resolve({ id: WID }) });
    expect(ok.status).toBe(200);
    expect(prismaMock.wishItem.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ imageCrop: crop }),
    }));
    expect(deleteFromCloudinaryUrl).not.toHaveBeenCalled();
  });

  it("user PUT: 200 self-update + 400 invalid image", async () => {
    prismaMock.user.update.mockResolvedValue({ id: ME, name: "Baru" });
    const ok = await userRoute.PUT(new Request("http://localhost/api/user", {
      method: "PUT", body: JSON.stringify({ name: "Baru" }),
    }));
    expect(ok.status).toBe(200);
    const bad = await userRoute.PUT(new Request("http://localhost/api/user", {
      method: "PUT", body: JSON.stringify({ image: "javascript:x" }),
    }));
    expect(bad.status).toBe(400);
  });

  it("partner GET: 200 partner, 404 solo, 401 anon", async () => {
    prismaMock.coupleMember.findUnique.mockResolvedValue({ couple: { members: [{ user: { id: "p2", name: "B" } }] } });
    expect((await partner.GET()).status).toBe(200);
    prismaMock.coupleMember.findUnique.mockResolvedValue(null);
    expect((await partner.GET()).status).toBe(404);
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await partner.GET()).status).toBe(401);
  });

  it("notes/[id] DELETE: author-only 403, 404, 200", async () => {
    prismaMock.dailyNote.findUnique.mockResolvedValue({ authorId: "someone-else" });
    const forbidden = await noteById.DELETE(new Request("http://localhost/api/notes/x", { method: "DELETE" }), { params: Promise.resolve({ id: "n1" }) });
    expect(forbidden.status).toBe(403);
    prismaMock.dailyNote.findUnique.mockResolvedValue(null);
    expect((await noteById.DELETE(new Request("http://localhost/api/notes/x", { method: "DELETE" }), { params: Promise.resolve({ id: "n1" }) })).status).toBe(404);
    prismaMock.dailyNote.findUnique.mockResolvedValue({ authorId: ME });
    expect((await noteById.DELETE(new Request("http://localhost/api/notes/x", { method: "DELETE" }), { params: Promise.resolve({ id: "n1" }) })).status).toBe(200);
    expect(prismaMock.dailyNote.delete).toHaveBeenCalledWith({ where: { id: "n1" } });
  });
});
