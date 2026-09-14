import { describe, it, expect, vi, beforeEach } from "vitest";

const ME = "cjld2cjxh0000qz8n0p3q4w5e1";
const OTHER = "cjld2cjxh0000qz8n0p3q4w5e9";
const COUPLE = "couple-1";

const prismaMock = vi.hoisted(() => ({
  $queryRawUnsafe: vi.fn(),
  photo: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  album: { findUnique: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  withRateLimit: vi.fn(),
  rateLimitConfigs: { write: {} },
}));
vi.mock("@/lib/redis", () => ({
  getCached: vi.fn(async () => null),
  setCached: vi.fn(async () => {}),
  invalidateCache: vi.fn(async () => {}),
  cacheKey: (...p: string[]) => p.join(":"),
}));
vi.mock("@/lib/couple", () => ({ getUserCoupleId: vi.fn(async () => COUPLE) }));
vi.mock("@/lib/pusher-server", () => ({ triggerCoupleEvent: vi.fn() }));
vi.mock("@/lib/cloudinary", () => ({ deleteFromCloudinary: vi.fn(async () => {}) }));

const { GET, POST } = await import("@/app/api/photos/route");
const detail = await import("@/app/api/photos/[id]/route");
const { auth } = await import("@/lib/auth");
const { withRateLimit } = await import("@/lib/rate-limit");
const { deleteFromCloudinary } = await import("@/lib/cloudinary");

process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
const IMG_URL = `https://res.cloudinary.com/test-cloud/image/upload/v1/ndjourney-web/${ME}/a.jpg`;
const PUB_ID = `ndjourney-web/${ME}/a`;

function allow(userId: string = ME) {
  vi.mocked(withRateLimit).mockResolvedValue({ allowed: true, remaining: 99, session: { user: { id: userId } } } as never);
}

describe("photos API contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
    vi.mocked(auth).mockResolvedValue({ user: { id: ME } } as never);
    allow();
  });

  it("GAL-05: GET list returns paginated data + counts (authed)", async () => {
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([{ id: "p1", createdAt: "2024-01-01T00:00:00.000Z" }])
      .mockResolvedValueOnce([{ total: 1, fotoTotal: 1, videoTotal: 0 }]);
    const res = await GET(new Request("http://localhost/api/photos?isFavorite=true&limit=30"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.hasMore).toBe(false);
  });

  it("GAL-05c: GET with albumId binds one param per placeholder (no 08P01)", async () => {
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([{ id: "p1", createdAt: "2024-01-01T00:00:00.000Z" }])
      .mockResolvedValueOnce([{ total: 1, fotoTotal: 1, videoTotal: 0 }]);
    const res = await GET(new Request("http://localhost/api/photos?albumId=cmrm6skmr000004jtligbccin&limit=30"));
    expect(res.status).toBe(200);
    // 2nd call is the triple-subselect count query: every $n must have a bound param.
    const [countSql, ...countParams] = prismaMock.$queryRawUnsafe.mock.calls[1];
    const maxPlaceholder = Math.max(...[...countSql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1])));
    expect(maxPlaceholder).toBe(countParams.length);
  });

  it("GAL-05b: GET public (anon) still 200", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0, fotoTotal: 0, videoTotal: 0 }]);
    const res = await GET(new Request("http://localhost/api/photos"));
    expect(res.status).toBe(200);
  });

  it("GAL-01: POST 201 happy path", async () => {
    prismaMock.photo.create.mockResolvedValue({ id: "p1" });
    const res = await POST(new Request("http://localhost/api/photos", {
      method: "POST",
      body: JSON.stringify({ url: IMG_URL, publicId: PUB_ID, isVideo: false }),
    }));
    expect(res.status).toBe(201);
    expect(prismaMock.photo.create).toHaveBeenCalledOnce();
  });

  it("GAL-01b: POST 400 on schema fail + foreign Cloudinary URL + foreign publicId", async () => {
    const bad = await POST(new Request("http://localhost/api/photos", { method: "POST", body: JSON.stringify({ url: "x" }) }));
    expect(bad.status).toBe(400);
    const foreign = await POST(new Request("http://localhost/api/photos", {
      method: "POST",
      body: JSON.stringify({ url: "https://res.cloudinary.com/evil/image/upload/a.jpg", publicId: "evil/a" }),
    }));
    expect(foreign.status).toBe(400);
    const stolen = await POST(new Request("http://localhost/api/photos", {
      method: "POST",
      body: JSON.stringify({ url: IMG_URL, publicId: `ndjourney-web/${OTHER}/a` }),
    }));
    expect(stolen.status).toBe(400);
    expect(prismaMock.photo.create).not.toHaveBeenCalled();
  });

  it("GAL-01c: POST 401 when rate-limit denies (no session)", async () => {
    vi.mocked(withRateLimit).mockResolvedValue({ allowed: false, remaining: 0, response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) } as never);
    const res = await POST(new Request("http://localhost/api/photos", { method: "POST", body: JSON.stringify({}) }));
    expect(res.status).toBe(401);
  });

  it("photo GET: 404 missing; private hidden from anon", async () => {
    prismaMock.photo.findUnique.mockResolvedValue(null);
    const missing = await detail.GET(new Request("http://localhost/api/photos/x"), { params: Promise.resolve({ id: "x" }) });
    expect(missing.status).toBe(404);

    prismaMock.photo.findUnique.mockResolvedValue({ id: "p1", isMilestoneOnly: false, albumId: null, isPublic: false });
    vi.mocked(auth).mockResolvedValue(null as never);
    const hidden = await detail.GET(new Request("http://localhost/api/photos/p1"), { params: Promise.resolve({ id: "p1" }) });
    expect(hidden.status).toBe(404);
  });

  it("photo PUT: 200 owner, 403 foreign couple, 404 missing, 400 empty patch", async () => {
    prismaMock.photo.findUnique.mockResolvedValue({ coupleId: COUPLE, uploadedById: ME });
    prismaMock.photo.update.mockResolvedValue({ id: "p1", caption: "hi" });
    const ok = await detail.PUT(new Request("http://localhost/api/photos/p1", { method: "PUT", body: JSON.stringify({ caption: "hi" }) }), { params: Promise.resolve({ id: "p1" }) });
    expect(ok.status).toBe(200);

    const { getUserCoupleId } = await import("@/lib/couple");
    vi.mocked(getUserCoupleId).mockResolvedValueOnce("couple-other");
    const forbidden = await detail.PUT(new Request("http://localhost/api/photos/p1", { method: "PUT", body: JSON.stringify({ caption: "hi" }) }), { params: Promise.resolve({ id: "p1" }) });
    expect(forbidden.status).toBe(403);

    prismaMock.photo.findUnique.mockResolvedValue(null);
    const missing = await detail.PUT(new Request("http://localhost/api/photos/x", { method: "PUT", body: JSON.stringify({ caption: "hi" }) }), { params: Promise.resolve({ id: "x" }) });
    expect(missing.status).toBe(404);

    prismaMock.photo.findUnique.mockResolvedValue({ coupleId: null, uploadedById: ME });
    const empty = await detail.PUT(new Request("http://localhost/api/photos/p1", { method: "PUT", body: JSON.stringify({}) }), { params: Promise.resolve({ id: "p1" }) });
    expect(empty.status).toBe(400);
  });

  it("GAL-09: DELETE removes Cloudinary first; foreign 403 never touches Cloudinary", async () => {
    prismaMock.photo.findUnique.mockResolvedValue({ publicId: PUB_ID, coupleId: COUPLE, uploadedById: ME, isVideo: false });
    const ok = await detail.DELETE(new Request("http://localhost/api/photos/p1", { method: "DELETE" }), { params: Promise.resolve({ id: "p1" }) });
    expect(ok.status).toBe(200);
    expect(deleteFromCloudinary).toHaveBeenCalledWith(PUB_ID, "image");
    expect(prismaMock.photo.delete).toHaveBeenCalledWith({ where: { id: "p1" } });

    vi.mocked(deleteFromCloudinary).mockClear();
    const { getUserCoupleId } = await import("@/lib/couple");
    vi.mocked(getUserCoupleId).mockResolvedValue("couple-other");
    const forbidden = await detail.DELETE(new Request("http://localhost/api/photos/p1", { method: "DELETE" }), { params: Promise.resolve({ id: "p1" }) });
    expect(forbidden.status).toBe(403);
    expect(deleteFromCloudinary).not.toHaveBeenCalled();
  });
});
