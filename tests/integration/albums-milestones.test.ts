import { describe, it, expect, vi, beforeEach } from "vitest";

const ME = "cjld2cjxh0000qz8n0p3q4w5e1";
const COUPLE = "couple-1";

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $queryRawUnsafe: vi.fn(),
  $transaction: vi.fn(async (ops: unknown[]) => ops),
  coupleMember: { findFirst: vi.fn(async () => ({ coupleId: "couple-1" })) },
  album: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  milestone: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  milestonePhoto: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
  photo: { create: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
  user: { findUnique: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  withRateLimit: vi.fn(),
  rateLimitConfigs: { write: {}, upload: {} },
}));
vi.mock("@/lib/redis", () => ({
  getCached: vi.fn(async () => null),
  setCached: vi.fn(async () => {}),
  invalidateCache: vi.fn(async () => {}),
  cacheKey: (...p: string[]) => p.join(":"),
}));
vi.mock("@/lib/couple", () => ({ getUserCoupleId: vi.fn(async () => COUPLE) }));
vi.mock("@/lib/pusher-server", () => ({ triggerCoupleEvent: vi.fn() }));
vi.mock("@/lib/batch", () => ({
  batchLoadUsers: vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, { id, name: "P", email: null, image: null }]))),
}));
vi.mock("@/lib/cloudinary", () => ({ deleteFromCloudinary: vi.fn(async () => {}) }));

const albums = await import("@/app/api/albums/route");
const albumById = await import("@/app/api/albums/[id]/route");
const milestones = await import("@/app/api/milestones/route");
const milestoneById = await import("@/app/api/milestones/[id]/route");
const bulk = await import("@/app/api/photos/bulk-upload/route");
const { auth } = await import("@/lib/auth");
const { withRateLimit } = await import("@/lib/rate-limit");

process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";

function allow(userId: string = ME) {
  vi.mocked(withRateLimit).mockResolvedValue({ allowed: true, remaining: 99, session: { user: { id: userId } } } as never);
}
const IMG = (who: string) => `https://res.cloudinary.com/test-cloud/image/upload/v1/ndjourney-web/${who}/a.jpg`;

describe("albums API contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
    vi.mocked(auth).mockResolvedValue({ user: { id: ME } } as never);
    allow();
  });

  it("GAL-10: GET list anon + authed 200", async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);
    const anon = await albums.GET(new Request("http://localhost/api/albums"));
    expect(anon.status).toBe(200);
    vi.mocked(auth).mockResolvedValue(null as never);
    const pub = await albums.GET(new Request("http://localhost/api/albums"));
    expect(pub.status).toBe(200);
  });

  it("GAL-10: POST 201 + 400 empty name", async () => {
    prismaMock.album.create.mockResolvedValue({ id: "a1", name: "Bali" });
    const ok = await albums.POST(new Request("http://localhost/api/albums", { method: "POST", body: JSON.stringify({ name: "Bali" }) }));
    expect(ok.status).toBe(201);
    const bad = await albums.POST(new Request("http://localhost/api/albums", { method: "POST", body: JSON.stringify({ name: "" }) }));
    expect(bad.status).toBe(400);
  });

  it("albums/[id] PUT: 200 own couple, 404 cross-couple (gate before Zod)", async () => {
    prismaMock.album.findUnique.mockResolvedValue({ coupleId: COUPLE });
    prismaMock.album.update.mockResolvedValue({ id: "a1", name: "New" });
    const ok = await albumById.PUT(new Request("http://localhost/api/albums/a1", { method: "PUT", body: JSON.stringify({ name: "New" }) }), { params: Promise.resolve({ id: "a1" }) });
    expect(ok.status).toBe(200);

    prismaMock.album.findUnique.mockResolvedValue({ coupleId: "couple-other" });
    const foreign = await albumById.PUT(new Request("http://localhost/api/albums/a1", { method: "PUT", body: JSON.stringify({}) }), { params: Promise.resolve({ id: "a1" }) });
    expect(foreign.status).toBe(404);
  });

  it("albums/[id] DELETE: 200 detaches photos via transaction", async () => {
    prismaMock.album.findUnique.mockResolvedValue({ coupleId: COUPLE });
    const res = await albumById.DELETE(new Request("http://localhost/api/albums/a1", { method: "DELETE" }), { params: Promise.resolve({ id: "a1" }) });
    expect(res.status).toBe(200);
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });
});

describe("milestones API contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: ME } } as never);
    allow();
  });

  it("TML-03: GET ordered desc + public filter for anon", async () => {
    prismaMock.milestone.findMany.mockResolvedValue([]);
    prismaMock.milestone.count.mockResolvedValue(0);
    prismaMock.milestonePhoto.findMany.mockResolvedValue([]);
    const res = await milestones.GET(new Request("http://localhost/api/milestones"));
    expect(res.status).toBe(200);
    expect(prismaMock.milestone.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { date: "desc" } }));
    vi.mocked(auth).mockResolvedValue(null as never);
    await milestones.GET(new Request("http://localhost/api/milestones"));
    expect(prismaMock.milestone.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { isPublic: true } }));
  });

  it("TML-01/02: POST 201 happy, 400 bad date/color/title", async () => {
    prismaMock.milestone.create.mockResolvedValue({ id: "m1", createdById: ME });
    const ok = await milestones.POST(new Request("http://localhost/api/milestones", {
      method: "POST",
      body: JSON.stringify({ title: "Jadian", date: "2024-02-14", color: "#F43F5E" }),
    }));
    expect(ok.status).toBe(201);
    for (const body of [
      { title: "", date: "2024-02-14" },
      { title: "x", date: "14-02-2024" },
      { title: "x", date: "2024-02-14", color: "red" },
    ]) {
      const bad = await milestones.POST(new Request("http://localhost/api/milestones", { method: "POST", body: JSON.stringify(body) }));
      expect(bad.status).toBe(400);
    }
  });

  it("milestones/[id] GET: 200, 404 missing + private hidden from anon", async () => {
    prismaMock.milestone.findUnique.mockResolvedValue({ id: "m1", createdById: ME, isPublic: true });
    prismaMock.user.findUnique.mockResolvedValue({ id: ME, name: "A", image: null });
    prismaMock.milestonePhoto.findMany.mockResolvedValue([]);
    const ok = await milestoneById.GET(new Request("http://localhost/api/milestones/m1"), { params: Promise.resolve({ id: "m1" }) });
    expect(ok.status).toBe(200);

    prismaMock.milestone.findUnique.mockResolvedValue(null);
    const missing = await milestoneById.GET(new Request("http://localhost/api/milestones/x"), { params: Promise.resolve({ id: "x" }) });
    expect(missing.status).toBe(404);

    prismaMock.milestone.findUnique.mockResolvedValue({ id: "m1", createdById: ME, isPublic: false });
    vi.mocked(auth).mockResolvedValue(null as never);
    const hidden = await milestoneById.GET(new Request("http://localhost/api/milestones/m1"), { params: Promise.resolve({ id: "m1" }) });
    expect(hidden.status).toBe(404);
  });

  it("milestones/[id] PUT: creator-only 403, 404, 200", async () => {
    prismaMock.milestone.findUnique.mockResolvedValue({ createdById: "someone-else" });
    const forbidden = await milestoneById.PUT(new Request("http://localhost/api/milestones/m1", { method: "PUT", body: JSON.stringify({ title: "x" }) }), { params: Promise.resolve({ id: "m1" }) });
    expect(forbidden.status).toBe(403);

    prismaMock.milestone.findUnique.mockResolvedValue(null);
    const missing = await milestoneById.PUT(new Request("http://localhost/api/milestones/x", { method: "PUT", body: JSON.stringify({ title: "x" }) }), { params: Promise.resolve({ id: "x" }) });
    expect(missing.status).toBe(404);

    prismaMock.milestone.findUnique.mockResolvedValue({ createdById: ME });
    prismaMock.milestone.update.mockResolvedValue({ id: "m1", createdById: ME });
    prismaMock.user.findUnique.mockResolvedValue({ id: ME, name: "A", image: null });
    prismaMock.milestonePhoto.findMany.mockResolvedValue([]);
    const ok = await milestoneById.PUT(new Request("http://localhost/api/milestones/m1", { method: "PUT", body: JSON.stringify({ title: "Baru" }) }), { params: Promise.resolve({ id: "m1" }) });
    expect(ok.status).toBe(200);
  });

  it("milestones/[id] DELETE: creator-only + 200", async () => {
    prismaMock.milestone.findUnique.mockResolvedValue({ createdById: "someone-else" });
    const forbidden = await milestoneById.DELETE(new Request("http://localhost/api/milestones/m1", { method: "DELETE" }), { params: Promise.resolve({ id: "m1" }) });
    expect(forbidden.status).toBe(403);
    prismaMock.milestone.findUnique.mockResolvedValue({ createdById: ME });
    prismaMock.photo.findMany.mockResolvedValue([]);
    const ok = await milestoneById.DELETE(new Request("http://localhost/api/milestones/m1", { method: "DELETE" }), { params: Promise.resolve({ id: "m1" }) });
    expect(ok.status).toBe(200);
    expect(prismaMock.milestone.delete).toHaveBeenCalledWith({ where: { id: "m1" } });
  });

  it("GAL-08: bulk-upload 201 all-valid, 400 empty", async () => {
    const { POST: bulkPost } = bulk;
    prismaMock.$queryRawUnsafe.mockResolvedValue([{ id: "p1" }]);
    const ok = await bulkPost(new Request("http://localhost/api/photos/bulk-upload", {
      method: "POST",
      body: JSON.stringify({ photos: [{ url: IMG(ME), publicId: `ndjourney-web/${ME}/a` }] }),
    }));
    expect([201, 207]).toContain(ok.status);
    const empty = await bulkPost(new Request("http://localhost/api/photos/bulk-upload", { method: "POST", body: JSON.stringify({ photos: [] }) }));
    expect(empty.status).toBe(400);
  });
});
