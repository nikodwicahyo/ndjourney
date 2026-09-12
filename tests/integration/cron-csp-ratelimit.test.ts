import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const prismaMock = vi.hoisted(() => ({
  letter: { findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/resend", () => ({ sendEmail: vi.fn(), timeCapsuleNotificationHtml: () => "<p>open</p>" }));
vi.mock("@/lib/pusher-server", () => ({ triggerCoupleEvent: vi.fn() }));
vi.mock("@/lib/redis", () => ({
  invalidateCache: vi.fn(async () => {}),
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 1, reset: 0 })),
  getCached: vi.fn(async () => null),
  setCached: vi.fn(async () => {}),
  cacheKey: (...p: string[]) => p.join(":"),
}));

const { GET } = await import("@/app/api/cron/time-capsule/route");
const { sendEmail } = await import("@/lib/resend");

// LTR-06 + SEC-05 + SEC-01 (rate config imported lazily to avoid next-auth chain at top)
describe("cron time-capsule + csp + rate-limit configs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
  });

  it("LTR-06: 401 without CRON_SECRET match, 200 processes due letters", async () => {
    prismaMock.letter.findMany.mockResolvedValue([
      {
        id: "l1", coupleId: "c1", title: "Capsule",
        author: { id: "a", name: "A", email: "a@x.com" },
        recipient: { id: "b", name: "B", email: "b@x.com" },
      },
    ]);
    prismaMock.letter.count.mockResolvedValue(0);

    const unauth = await GET(new Request("http://localhost/api/cron/time-capsule"));
    expect(unauth.status).toBe(401);

    vi.mocked(sendEmail).mockResolvedValue({ data: { id: "m1" } });
    const ok = await GET(
      new Request("http://localhost/api/cron/time-capsule", { headers: { authorization: "Bearer test-cron-secret" } }),
    );
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.message).toContain("1 time capsule");
    expect(prismaMock.letter.update).toHaveBeenCalled();
  });

  it("SEC-05: vercel.json CSP matches lib/csp.ts", async () => {
    const { CSP_DIRECTIVES } = await import("@/lib/csp");
    const raw = readFileSync(join(process.cwd(), "vercel.json"), "utf-8");
    const cfg = JSON.parse(raw);
    const entry = cfg.headers?.find((h: { source: string }) => h.source === "/(.*)")?.headers?.find((h: { key: string }) => h.key === "Content-Security-Policy");
    expect(entry?.value).toBe(CSP_DIRECTIVES.join("; "));
  });

  it("SEC-01: rate-limit budgets match TESTPLAN", async () => {
    const { rateLimitConfigs } = await import("@/lib/rate-limit");
    expect(rateLimitConfigs.upload).toMatchObject({ maxRequests: 50, windowSeconds: 3600 });
    expect(rateLimitConfigs.letter).toMatchObject({ maxRequests: 30, windowSeconds: 3600 });
    expect(rateLimitConfigs.register).toMatchObject({ maxRequests: 3, windowSeconds: 3600 });
    expect(rateLimitConfigs.location.maxRequests).toBeGreaterThanOrEqual(540);
  });
});
