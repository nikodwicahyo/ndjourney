import { beforeEach, describe, expect, it, vi } from "vitest";

// Device-link login: 6-digit, one-time, 10-minute, 3-attempt code.
// The DB mock is deliberately strict about which methods are called: an
// extra write on the hot path is how this kind of code silently becomes a
// brute-force oracle or leaves replayable codes behind.
const prismaMock = vi.hoisted(() => ({
  deviceLinkCode: {
    deleteMany: vi.fn(async () => ({ count: 0 })),
    create: vi.fn(async () => ({})),
    findUnique: vi.fn(async () => null),
    update: vi.fn(async () => ({})),
    updateMany: vi.fn(async () => ({ count: 1 })),
  },
}));
const bcryptMock = vi.hoisted(() => ({
  hash: vi.fn(async () => "bcrypt-hash"),
  compare: vi.fn(async (_code: string, _hash: string) => true),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("bcryptjs", () => ({ default: bcryptMock }));

const FUTURE = Date.now() + 9 * 60 * 1000;
const USER = {
  id: "u1",
  email: "a@x.com",
  name: "A",
  image: null,
  role: "PARTNER",
};

function row(over: Record<string, unknown> = {}) {
  return {
    id: "c1",
    userId: USER.id,
    codeHash: "bcrypt-hash",
    lookupHash: "lookup",
    attempts: 0,
    usedAt: null,
    expiresAt: new Date(FUTURE),
    deviceId: null,
    createdAt: new Date(FUTURE - 60_000),
    user: USER,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AUTH_SECRET = "test-secret";
  prismaMock.deviceLinkCode.findUnique.mockResolvedValue(row() as never);
  prismaMock.deviceLinkCode.updateMany.mockResolvedValue({ count: 1 });
  bcryptMock.compare.mockResolvedValue(true);
});

describe("device-link code primitives", () => {
  it("generates six digits and varies across calls", async () => {
    const { generateDeviceCode, isValidDeviceCode } = await import("@/lib/device-link");
    const codes = new Set(Array.from({ length: 12 }, () => generateDeviceCode()));
    for (const code of codes) {
      expect(code).toMatch(/^\d{6}$/);
      expect(isValidDeviceCode(code)).toBe(true);
    }
    expect(codes.size).toBeGreaterThan(1);
  });

  it("rejects anything that is not exactly six digits", async () => {
    const { isValidDeviceCode } = await import("@/lib/device-link");
    for (const bad of ["", "12345", "1234567", "abcdef", 123456, null, undefined, " 123456"]) {
      expect(isValidDeviceCode(bad)).toBe(false);
    }
  });

  it("hashes with the server secret: deterministic, secret-bound, code-specific", async () => {
    const { codeLookupHash } = await import("@/lib/device-link");
    const a = codeLookupHash("123456");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(codeLookupHash("123456")).toBe(a);
    expect(codeLookupHash("654321")).not.toBe(a);
    process.env.AUTH_SECRET = "other-secret";
    expect(codeLookupHash("123456")).not.toBe(a);
  });

  it("fails closed when no auth secret is configured", async () => {
    const { codeLookupHash } = await import("@/lib/device-link");
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    expect(() => codeLookupHash("123456")).toThrow(/AUTH_SECRET/);
  });
});

describe("createDeviceLink", () => {
  it("revokes older codes, stores only hashes, returns a 10-minute expiry", async () => {
    const { createDeviceLink } = await import("@/lib/device-link");
    const { code, expiresAt } = await createDeviceLink(USER.id);

    expect(code).toMatch(/^\d{6}$/);
    expect(new Date(expiresAt).getTime() - Date.now()).toBeGreaterThan(9 * 60 * 1000);
    expect(prismaMock.deviceLinkCode.deleteMany).toHaveBeenCalledWith({ where: { userId: USER.id } });

    const createCalls = prismaMock.deviceLinkCode.create.mock.calls as unknown as Array<[{ data: Record<string, unknown> }]>;
    const data = createCalls[0][0];
    expect(data.data).toMatchObject({ userId: USER.id, codeHash: "bcrypt-hash" });
    expect(data.data.lookupHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(data.data)).not.toContain(code);
  });
});

describe("consumeDeviceCode", () => {
  it("returns the user and atomically claims the code with the device id", async () => {
    const { consumeDeviceCode } = await import("@/lib/device-link");
    const user = await consumeDeviceCode("123456", "device-1");

    expect(user).toMatchObject({ id: USER.id, email: USER.email, role: USER.role });
    expect(prismaMock.deviceLinkCode.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", usedAt: null, attempts: { lt: 3 } },
      data: { usedAt: expect.any(Date), deviceId: "device-1" },
    });
  });

  it("rejects an invalid shape before touching the database", async () => {
    const { consumeDeviceCode } = await import("@/lib/device-link");
    expect(await consumeDeviceCode("abc")).toBeNull();
    expect(prismaMock.deviceLinkCode.findUnique).not.toHaveBeenCalled();
  });

  it("rejects an unknown code but still pays a bcrypt compare (timing)", async () => {
    prismaMock.deviceLinkCode.findUnique.mockResolvedValue(null);
    const { consumeDeviceCode } = await import("@/lib/device-link");
    expect(await consumeDeviceCode("123456")).toBeNull();
    expect(bcryptMock.compare).toHaveBeenCalled();
    expect(prismaMock.deviceLinkCode.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a wrong code and increments the attempt counter", async () => {
    bcryptMock.compare.mockResolvedValue(false);
    const { consumeDeviceCode } = await import("@/lib/device-link");
    expect(await consumeDeviceCode("123456")).toBeNull();
    expect(prismaMock.deviceLinkCode.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { attempts: { increment: 1 } },
    });
  });

  it("revokes the code on the third failed attempt", async () => {
    prismaMock.deviceLinkCode.findUnique.mockResolvedValue(row({ attempts: 2 }) as never);
    bcryptMock.compare.mockResolvedValue(false);
    const { consumeDeviceCode } = await import("@/lib/device-link");
    expect(await consumeDeviceCode("123456")).toBeNull();
    expect(prismaMock.deviceLinkCode.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { attempts: { increment: 1 }, usedAt: expect.any(Date) },
    });
  });

  it("rejects an expired code even when the hash matches", async () => {
    prismaMock.deviceLinkCode.findUnique.mockResolvedValue(
      row({ expiresAt: new Date(Date.now() - 1000) }) as never,
    );
    const { consumeDeviceCode } = await import("@/lib/device-link");
    expect(await consumeDeviceCode("123456")).toBeNull();
    expect(prismaMock.deviceLinkCode.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an already-used code", async () => {
    prismaMock.deviceLinkCode.findUnique.mockResolvedValue(row({ usedAt: new Date() }) as never);
    const { consumeDeviceCode } = await import("@/lib/device-link");
    expect(await consumeDeviceCode("123456")).toBeNull();
    expect(prismaMock.deviceLinkCode.updateMany).not.toHaveBeenCalled();
  });

  it("does not log in when a concurrent request already claimed the code", async () => {
    prismaMock.deviceLinkCode.updateMany.mockResolvedValue({ count: 0 });
    const { consumeDeviceCode } = await import("@/lib/device-link");
    expect(await consumeDeviceCode("123456")).toBeNull();
  });
});

describe("revokeDeviceLinks", () => {
  it("deletes every code for the user", async () => {
    const { revokeDeviceLinks } = await import("@/lib/device-link");
    await revokeDeviceLinks(USER.id);
    expect(prismaMock.deviceLinkCode.deleteMany).toHaveBeenCalledWith({ where: { userId: USER.id } });
  });
});
