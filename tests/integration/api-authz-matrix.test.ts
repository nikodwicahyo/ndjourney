import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

// Every protected handler must reject an unauthenticated caller before any
// body parse, DB read, or external side effect. `withRateLimit` is deliberately
// left real: it is the shared auth gate for write routes.

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(async () => []),
  $queryRawUnsafe: vi.fn(async () => []),
  $transaction: vi.fn(async (arg: unknown) => arg),
  album: { findUnique: vi.fn(), findMany: vi.fn(async () => []) },
  milestone: { findUnique: vi.fn(), findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
  milestonePhoto: { findMany: vi.fn(async () => []) },
  photo: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(async () => []), create: vi.fn(), update: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  wishItem: { findUnique: vi.fn(), findMany: vi.fn(async () => []), count: vi.fn(async () => 0), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  letter: { findUnique: vi.fn(), findMany: vi.fn(async () => []), count: vi.fn(async () => 0), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  dailyNote: { findUnique: vi.fn(), findMany: vi.fn(async () => []), create: vi.fn(), delete: vi.fn() },
  gameQuestion: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  gameScore: { count: vi.fn(async () => 0) },
  coupleMember: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(async () => []) },
  coupleConfig: { findFirst: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
  locationShare: { findUnique: vi.fn(), upsert: vi.fn() },
  userLocation: { findUnique: vi.fn(), upsert: vi.fn() },
  userLocationHistory: { findFirst: vi.fn(), findMany: vi.fn(async () => []), create: vi.fn(), deleteMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => null) }));
vi.mock("@/lib/redis", () => ({
  getCached: vi.fn(async () => null),
  setCached: vi.fn(async () => {}),
  invalidateCache: vi.fn(async () => {}),
  cacheKey: (...p: string[]) => p.join(":"),
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 99 })),
}));
vi.mock("@/lib/cloudinary", () => ({
  deleteFromCloudinary: vi.fn(async () => {}),
  deleteFromCloudinaryUrl: vi.fn(async () => {}),
  getCloudinaryUsage: vi.fn(async () => ({ storageUsed: 0, storageLimit: 0 })),
  uploadBufferToCloudinary: vi.fn(async () => ({})),
}));
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async () => ({})),
  noteNotificationHtml: () => "",
  letterNotificationHtml: () => "",
  safeAppUrl: (p: string) => `http://localhost${p}`,
}));
vi.mock("@/lib/pusher-server", () => ({
  triggerCoupleEvent: vi.fn(),
  getPusherServer: vi.fn(() => ({ trigger: vi.fn(), authenticate: vi.fn() })),
}));
vi.mock("@/lib/batch", () => ({
  batchLoadUsers: vi.fn(async () => new Map()),
  mapUsersToRecords: vi.fn(() => []),
  invalidateUserCache: vi.fn(async () => {}),
  clearUserCache: vi.fn(),
  toPublicUser: vi.fn((u: unknown) => u),
}));
vi.mock("@/lib/sanitize-html", () => ({ sanitizeStoredHtml: (s: string) => s }));
vi.mock("@/lib/upload-verify", () => ({
  verifyUploadForSave: vi.fn(async () => ({})),
  UploadVerifyError: class UploadVerifyError extends Error {},
}));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ set: vi.fn(), get: vi.fn() })) }));

const albums = await import("@/app/api/albums/route");
const albumById = await import("@/app/api/albums/[id]/route");
const milestones = await import("@/app/api/milestones/route");
const milestoneById = await import("@/app/api/milestones/[id]/route");
const notes = await import("@/app/api/notes/route");
const noteById = await import("@/app/api/notes/[id]/route");
const wishes = await import("@/app/api/wishes/route");
const wishById = await import("@/app/api/wishes/[id]/route");
const photos = await import("@/app/api/photos/route");
const photoById = await import("@/app/api/photos/[id]/route");
const photoBulk = await import("@/app/api/photos/bulk-upload/route");
const letters = await import("@/app/api/letters/route");
const letterById = await import("@/app/api/letters/[id]/route");
const letterOpen = await import("@/app/api/letters/[id]/open/route");
const location = await import("@/app/api/location/route");
const locationHistory = await import("@/app/api/location/history/route");
const locationShare = await import("@/app/api/location/share/route");
const locationHeart = await import("@/app/api/location/heart/route");
const dashboardStats = await import("@/app/api/dashboard/stats/route");
const dashboardActivity = await import("@/app/api/dashboard/activity/route");
const partner = await import("@/app/api/partner/route");
const storageUsage = await import("@/app/api/storage/usage/route");
const couple = await import("@/app/api/couple/route");
const user = await import("@/app/api/user/route");
const gamesQuestions = await import("@/app/api/games/questions/route");
const gameQuestionById = await import("@/app/api/games/questions/[id]/route");
const uploadDirect = await import("@/app/api/upload/route");
const uploadSign = await import("@/app/api/upload/sign/route");
const uploadServer = await import("@/app/api/upload/server/route");
const uploadBulk = await import("@/app/api/upload/bulk/route");
const uploadDelete = await import("@/app/api/upload/[publicId]/route");
const pusherAuth = await import("@/app/api/pusher/auth/route");

function req(path: string, method = "GET") {
  return new Request(`http://localhost${path}`, {
    method,
    ...(method === "GET" || method === "DELETE" ? {} : { body: "{}" }),
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

const cases: Array<[string, () => Promise<Response>]> = [
  ["POST /api/albums", () => albums.POST(req("/api/albums", "POST"))],
  ["PUT /api/albums/[id]", () => albumById.PUT(req("/api/albums/a1", "PUT"), params("a1"))],
  ["DELETE /api/albums/[id]", () => albumById.DELETE(req("/api/albums/a1", "DELETE"), params("a1"))],

  ["POST /api/milestones", () => milestones.POST(req("/api/milestones", "POST"))],
  ["PUT /api/milestones/[id]", () => milestoneById.PUT(req("/api/milestones/m1", "PUT"), params("m1"))],
  ["DELETE /api/milestones/[id]", () => milestoneById.DELETE(req("/api/milestones/m1", "DELETE"), params("m1"))],

  ["POST /api/notes", () => notes.POST(req("/api/notes", "POST"))],
  ["DELETE /api/notes/[id]", () => noteById.DELETE(req("/api/notes/n1", "DELETE"), params("n1"))],

  ["POST /api/wishes", () => wishes.POST(req("/api/wishes", "POST"))],
  ["PUT /api/wishes/[id]", () => wishById.PUT(req("/api/wishes/w1", "PUT"), params("w1"))],
  ["DELETE /api/wishes/[id]", () => wishById.DELETE(req("/api/wishes/w1", "DELETE"), params("w1"))],

  ["POST /api/photos", () => photos.POST(req("/api/photos", "POST"))],
  ["PUT /api/photos/[id]", () => photoById.PUT(req("/api/photos/p1", "PUT"), params("p1"))],
  ["DELETE /api/photos/[id]", () => photoById.DELETE(req("/api/photos/p1", "DELETE"), params("p1"))],
  ["POST /api/photos/bulk-upload", () => photoBulk.POST(req("/api/photos/bulk-upload", "POST"))],

  ["GET /api/letters", () => letters.GET(req("/api/letters"))],
  ["POST /api/letters", () => letters.POST(req("/api/letters", "POST"))],
  ["GET /api/letters/[id]", () => letterById.GET(req("/api/letters/l1"), params("l1"))],
  ["DELETE /api/letters/[id]", () => letterById.DELETE(req("/api/letters/l1", "DELETE"), params("l1"))],
  ["PUT /api/letters/[id]/open", () => letterOpen.PUT(req("/api/letters/l1/open", "PUT"), params("l1"))],

  ["GET /api/location", () => location.GET()],
  ["POST /api/location", () => location.POST(req("/api/location", "POST"))],
  ["GET /api/location/history", () => locationHistory.GET()],
  ["PUT /api/location/share", () => locationShare.PUT(req("/api/location/share", "PUT"))],
  ["POST /api/location/heart", () => locationHeart.POST(req("/api/location/heart", "POST"))],

  ["GET /api/dashboard/stats", () => dashboardStats.GET()],
  ["GET /api/dashboard/activity", () => dashboardActivity.GET()],
  ["GET /api/partner", () => partner.GET()],
  ["GET /api/storage/usage", () => storageUsage.GET(new NextRequest("http://localhost/api/storage/usage"))],

  ["PUT /api/couple", () => couple.PUT(req("/api/couple", "PUT"))],
  ["PUT /api/user", () => user.PUT(req("/api/user", "PUT"))],

  ["POST /api/games/questions", () => gamesQuestions.POST(req("/api/games/questions", "POST"))],
  ["PUT /api/games/questions/[id]", () => gameQuestionById.PUT(req("/api/games/questions/q1", "PUT"), params("q1"))],
  ["DELETE /api/games/questions/[id]", () => gameQuestionById.DELETE(req("/api/games/questions/q1", "DELETE"), params("q1"))],

  ["POST /api/upload", () => uploadDirect.POST(req("/api/upload", "POST"))],
  ["POST /api/upload/sign", () => uploadSign.POST(req("/api/upload/sign", "POST"))],
  ["POST /api/upload/server", () => uploadServer.POST(req("/api/upload/server", "POST"))],
  ["POST /api/upload/bulk", () => uploadBulk.POST(req("/api/upload/bulk", "POST"))],
  ["DELETE /api/upload/[publicId]", () => uploadDelete.DELETE(req("/api/upload/a", "DELETE"), { params: Promise.resolve({ publicId: "a" }) })],

  ["POST /api/pusher/auth", () => pusherAuth.POST(req("/api/pusher/auth", "POST"))],
];

describe("API authorization matrix: anonymous denial", () => {
  it.each(cases)("%s rejects anonymous callers with 401", async (_name, call) => {
    const res = await call();
    expect(res.status).toBe(401);
  });

  it("no protected handler touched the database or external services while unauthenticated", async () => {
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    expect(prismaMock.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(prismaMock.album.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.milestone.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.photo.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.wishItem.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.letter.findUnique).not.toHaveBeenCalled();

    const { deleteFromCloudinary, uploadBufferToCloudinary } = await import("@/lib/cloudinary");
    const { sendEmail } = await import("@/lib/email");
    expect(deleteFromCloudinary).not.toHaveBeenCalled();
    expect(uploadBufferToCloudinary).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
