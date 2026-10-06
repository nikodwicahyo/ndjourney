import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({ $queryRaw: vi.fn() }));
const redisMock = vi.hoisted(() => ({ ping: vi.fn(async () => "PONG") }));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/redis", () => ({
  redis: redisMock,
  getCached: vi.fn(async () => null),
  setCached: vi.fn(async () => {}),
  invalidateCache: vi.fn(async () => {}),
  cacheKey: (...p: string[]) => p.join(":"),
}));

const { GET } = await import("@/app/api/health/route");

describe("health endpoint (C-08 deploy smoke)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    redisMock.ping.mockResolvedValue("PONG");
  });

  it("200 ok when database + cache reachable", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "ok",
      checks: { database: "ok", cache: "ok" },
    });
  });

  it("503 degraded when the database is down", async () => {
    prismaMock.$queryRaw.mockRejectedValueOnce(new Error("connect failed"));
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.database).toBe("unreachable");
  });
});
