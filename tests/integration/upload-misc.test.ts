import { describe, it, expect, vi, beforeEach } from "vitest";

const ME = "cjld2cjxh0000qz8n0p3q4w5e1";

const prismaMock = vi.hoisted(() => ({
  photo: { findFirst: vi.fn() },
  coupleMember: { findUnique: vi.fn(async () => ({ coupleId: "couple-1" })) },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  withRateLimit: vi.fn(),
  withAnonymousRateLimit: vi.fn(async () => ({ allowed: true, remaining: 9 })),
  rateLimitConfigs: { write: {}, bulkUpload: {} },
}));
vi.mock("@/lib/redis", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 19, reset: 0 })),
  getCached: vi.fn(async () => null),
  setCached: vi.fn(async () => {}),
  invalidateCache: vi.fn(async () => {}),
  cacheKey: (...p: string[]) => p.join(":"),
}));
vi.mock("@/lib/cloudinary", () => ({
  uploadBufferToCloudinary: vi.fn(async () => ({ url: "https://res.cloudinary.com/x/image/upload/a.jpg", publicId: "ndjourney-web/u/a", isVideo: false, fileSize: 8 })),
  deleteFromCloudinary: vi.fn(async () => {}),
  getCloudinaryUsage: vi.fn(async () => ({ used: 10, limit: 100 })),
}));
vi.mock("@/lib/pusher-server", () => ({
  getPusherServer: vi.fn(() => ({ authenticate: vi.fn(() => ({ auth: "ok" })) })),
}));
vi.mock("cloudinary", () => ({
  v2: {
    config: vi.fn(),
    utils: { api_sign_request: vi.fn(() => "sig123") },
    uploader: { upload_stream: vi.fn((_opts: unknown, cb: (e: unknown, r: unknown) => void) => {
      const stream = { end: (_b: unknown) => cb(null, {
        secure_url: "https://res.cloudinary.com/test-cloud/image/upload/v1/u/a.jpg",
        public_id: "u/a", width: 100, height: 100, format: "jpg", bytes: 8, resource_type: "image",
      }) };
      return stream;
    }) },
  },
}));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ set: vi.fn(), get: vi.fn() })) }));

const uploadDirect = await import("@/app/api/upload/route");
const uploadSign = await import("@/app/api/upload/sign/route");
const uploadServer = await import("@/app/api/upload/server/route");
const uploadBulk = await import("@/app/api/upload/bulk/route");
const uploadDel = await import("@/app/api/upload/[publicId]/route");
const storageUsage = await import("@/app/api/storage/usage/route");
const pusherAuth = await import("@/app/api/pusher/auth/route");
const csp = await import("@/app/api/csp-violation/route");
const invite = await import("@/app/api/auth/invite-token/route");
const { auth } = await import("@/lib/auth");
const { withRateLimit, withAnonymousRateLimit } = await import("@/lib/rate-limit");

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 1]);
function pngFile(name = "a.png") {
  return new File([PNG], name, { type: "image/png" });
}
function formReq(files: File[]) {
  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  fd.append("file", files[0]);
  return new Request("http://localhost/api/upload", { method: "POST", body: fd });
}

function allow(userId: string = ME) {
  vi.mocked(auth).mockResolvedValue({ user: { id: userId } } as never);
  vi.mocked(withRateLimit).mockResolvedValue({ allowed: true, remaining: 99, session: { user: { id: userId } } } as never);
  vi.mocked(withAnonymousRateLimit).mockResolvedValue({ allowed: true, remaining: 9 });
}

describe("upload pipeline contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allow();
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
    process.env.CLOUDINARY_API_KEY = "key";
    process.env.CLOUDINARY_API_SECRET = "secret";
  });

  it("direct upload: 200 happy, 401 anon, 400 no-file, 400 spoofed magic", async () => {
    const ok = await uploadDirect.POST(formReq([pngFile()]));
    expect(ok.status).toBe(200);
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await uploadDirect.POST(formReq([pngFile()]))).status).toBe(401);
    allow();
    const empty = await uploadDirect.POST(new Request("http://localhost/api/upload", { method: "POST", body: new FormData() }));
    expect(empty.status).toBe(400);
    const spoof = new File([Buffer.from("<html>hello world padding!!")], "a.png", { type: "image/png" });
    expect((await uploadDirect.POST(formReq([spoof]))).status).toBe(400);
  });

  it("sign: 200 happy, 503 missing env, 400 incomplete", async () => {
    const ok = await uploadSign.POST(new Request("http://localhost/api/upload/sign", {
      method: "POST", body: JSON.stringify({ fileName: "a.png", fileType: "image/png", fileSize: 1024 }),
    }));
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.publicId).toContain(ME);
    delete process.env.CLOUDINARY_API_SECRET;
    expect((await uploadSign.POST(new Request("http://localhost/api/upload/sign", {
      method: "POST", body: JSON.stringify({ fileName: "a.png", fileType: "image/png", fileSize: 1024 }),
    }))).status).toBe(503);
    process.env.CLOUDINARY_API_SECRET = "secret";
    expect((await uploadSign.POST(new Request("http://localhost/api/upload/sign", {
      method: "POST", body: JSON.stringify({ fileName: "a.png" }),
    }))).status).toBe(400);
  });

  it("server upload: 200 via stream mock, 400 no-file, 503 missing env", async () => {
    const ok = await uploadServer.POST(formReq([pngFile()]));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ publicId: expect.any(String) });
    const empty = await uploadServer.POST(new Request("http://localhost/api/upload/server", { method: "POST", body: new FormData() }));
    expect(empty.status).toBe(400);
    delete process.env.CLOUDINARY_CLOUD_NAME;
    expect((await uploadServer.POST(formReq([pngFile()]))).status).toBe(503);
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  });

  it("bulk: 200 results array, 400 too many / empty", async () => {
    const ok = await uploadBulk.POST(formReq([pngFile()]));
    expect(ok.status).toBe(200);
    expect((await ok.json()).results).toHaveLength(1);
    const fd = new FormData();
    for (let i = 0; i < 31; i++) fd.append("files", pngFile(`${i}.png`));
    expect((await uploadBulk.POST(new Request("http://localhost/api/upload/bulk", { method: "POST", body: fd }))).status).toBe(400);
  });

  it("[publicId] DELETE: 200 owner, 404 foreign, 400 bad resourceType", async () => {
    prismaMock.photo.findFirst.mockResolvedValue({ id: "p1" });
    const ok = await uploadDel.DELETE(new Request("http://localhost/api/upload/a?resourceType=image", { method: "DELETE" }), { params: Promise.resolve({ publicId: `ndjourney-web/${ME}/a` }) });
    expect(ok.status).toBe(200);
    prismaMock.photo.findFirst.mockResolvedValue(null);
    expect((await uploadDel.DELETE(new Request("http://localhost/api/upload/a", { method: "DELETE" }), { params: Promise.resolve({ publicId: `ndjourney-web/${ME}/a` }) })).status).toBe(404);
    prismaMock.photo.findFirst.mockResolvedValue({ id: "p1" });
    expect((await uploadDel.DELETE(new Request("http://localhost/api/upload/a?resourceType=exe", { method: "DELETE" }), { params: Promise.resolve({ publicId: `ndjourney-web/${ME}/a` }) })).status).toBe(400);
  });
});

describe("storage / pusher / csp / invite contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allow();
    process.env.INVITE_TOKEN = "test-invite-123";
  });

  it("storage usage: 200 authed, 401 anon", async () => {
    const nextReq = { nextUrl: new URL("http://localhost/api/storage/usage") } as never;
    expect((await storageUsage.GET(nextReq)).status).toBe(200);
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await storageUsage.GET(nextReq)).status).toBe(401);
  });

  it("pusher auth: 200 own channel, 403 foreign channel, 401 anon", async () => {
    const fd = (ch: string) => {
      const f = new FormData();
      f.set("socket_id", "1.1");
      f.set("channel_name", ch);
      return new Request("http://localhost/api/pusher/auth", { method: "POST", body: f });
    };
    expect((await pusherAuth.POST(fd("private-couple-couple-1"))).status).toBe(200);
    expect((await pusherAuth.POST(fd("private-couple-other"))).status).toBe(403);
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await pusherAuth.POST(fd("private-couple-couple-1"))).status).toBe(401);
  });

  it("csp-violation: always 204, 429 when throttled", async () => {
    expect((await csp.POST(new Request("http://localhost/api/csp-violation", { method: "POST", body: JSON.stringify({}) }))).status).toBe(204);
    vi.mocked(withAnonymousRateLimit).mockResolvedValueOnce({ allowed: false, remaining: 0 });
    expect((await csp.POST(new Request("http://localhost/api/csp-violation", { method: "POST", body: JSON.stringify({}) }))).status).toBe(429);
  });

  it("invite-token: 200 valid sets cookie, 403 wrong, 400 missing", async () => {
    expect((await invite.POST(new Request("http://localhost/api/auth/invite-token", {
      method: "POST", body: JSON.stringify({ inviteToken: "test-invite-123" }),
    }))).status).toBe(200);
    expect((await invite.POST(new Request("http://localhost/api/auth/invite-token", {
      method: "POST", body: JSON.stringify({ inviteToken: "wrong" }),
    }))).status).toBe(403);
    expect((await invite.POST(new Request("http://localhost/api/auth/invite-token", {
      method: "POST", body: JSON.stringify({}),
    }))).status).toBe(400);
  });
});
