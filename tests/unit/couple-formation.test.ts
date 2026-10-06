import { describe, it, expect, vi, beforeEach } from "vitest";

// P1 split-brain regression tests (mocked Prisma, no live DB — same caveat
// as the MR-09 quota test). True concurrency needs Postgres; these prove
// the mechanism: single locked transaction, no skipDuplicates swallow,
// P2002 loser rejoins instead of forming a second couple.
const executeRawMock = vi.hoisted(() =>
  vi.fn((..._args: unknown[]) => Promise.resolve([{ locked: 1 } as unknown])),
);

const prismaMock = vi.hoisted(() => {
  const coupleMember = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    count: vi.fn(),
  };
  const mock = {
    coupleMember,
    couple: { create: vi.fn() },
    user: { count: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({
        $executeRaw: executeRawMock,
        coupleMember,
        couple: mock.couple,
        user: mock.user,
      }),
    ),
  };
  return mock;
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next-auth", () => ({
  default: vi.fn(() => ({ handlers: {}, signIn: vi.fn(), signOut: vi.fn(), auth: vi.fn() })),
}));
vi.mock("next-auth/providers/google", () => ({ default: vi.fn(() => ({})) }));
vi.mock("next-auth/providers/credentials", () => ({ default: vi.fn(() => ({})) }));
vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: vi.fn(() => ({})) }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() })) }));

async function load() {
  vi.resetModules();
  return (await import("@/lib/auth")).ensureCouple;
}

const partners = [{ id: "u1" }, { id: "u2" }];

function stubFreshPairing() {
  prismaMock.coupleMember.findUnique.mockResolvedValue(null);
  prismaMock.user.count.mockResolvedValue(2);
  prismaMock.user.findMany.mockResolvedValue(partners);
  prismaMock.coupleMember.findFirst.mockResolvedValue(null);
  prismaMock.couple.create.mockResolvedValue({ id: "c-new" });
  prismaMock.coupleMember.createMany.mockResolvedValue({ count: 2 });
  prismaMock.coupleMember.create.mockResolvedValue({ id: "m" });
}

describe("ensureCouple split-brain fix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubFreshPairing();
  });

  it("serializes pairing: lock first, then check+create in one transaction", async () => {
    const ensureCouple = await load();
    await ensureCouple("u1");
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(executeRawMock).toHaveBeenCalledOnce();
    const rawCalls = executeRawMock.mock.calls as unknown[][];
    const firstArg = rawCalls[0]?.[0] as ArrayLike<unknown> | undefined;
    const lockSql = String(firstArg?.[0] ?? "");
    expect(lockSql).toContain("pg_advisory_xact_lock");
    // lock precedes every read and write inside the transaction
    const lockOrder = executeRawMock.mock.invocationCallOrder[0] ?? -1;
    const ordered: Array<{ mock: { invocationCallOrder: number[] } }> = [
      prismaMock.coupleMember.findUnique,
      prismaMock.user.count,
      prismaMock.user.findMany,
      prismaMock.coupleMember.findFirst,
      prismaMock.couple.create,
      prismaMock.coupleMember.createMany,
    ];
    for (const fn of ordered) {
      expect(fn.mock.invocationCallOrder[0]).toBeGreaterThan(lockOrder);
    }
  });

  it("formation does not swallow conflicts (no skipDuplicates)", async () => {
    const ensureCouple = await load();
    await ensureCouple("u1");
    expect(prismaMock.coupleMember.createMany).toHaveBeenCalledOnce();
    const arg = prismaMock.coupleMember.createMany.mock.calls[0][0];
    expect(arg.skipDuplicates).not.toBe(true);
    expect(arg.data).toHaveLength(2);
  });

  it("P2002 loser rejoins the winner — no second couple", async () => {
    prismaMock.couple.create.mockRejectedValueOnce({ code: "P2002" });
    // winner visible on retry
    prismaMock.coupleMember.findFirst
      .mockResolvedValueOnce(null) // inside tx: nobody yet
      .mockResolvedValueOnce({ coupleId: "c-winner" }); // retry after P2002
    const ensureCouple = await load();
    await ensureCouple("u2");
    expect(prismaMock.couple.create).toHaveBeenCalledOnce();
    expect(prismaMock.coupleMember.create).toHaveBeenCalledWith({
      data: { coupleId: "c-winner", userId: "u2" },
    });
  });

  it("join path respects the 2-member cap inside the transaction", async () => {
    prismaMock.coupleMember.findFirst.mockResolvedValue({ coupleId: "c1", userId: "u1" });
    prismaMock.coupleMember.count.mockResolvedValue(2);
    const ensureCouple = await load();
    await ensureCouple("u2");
    expect(prismaMock.coupleMember.create).not.toHaveBeenCalled();
    expect(prismaMock.couple.create).not.toHaveBeenCalled();
  });

  it("already-paired user is a no-op (no couple created)", async () => {
    prismaMock.coupleMember.findUnique.mockResolvedValue({ id: "m1" });
    const ensureCouple = await load();
    await ensureCouple("u1");
    expect(prismaMock.couple.create).not.toHaveBeenCalled();
    expect(prismaMock.user.count).not.toHaveBeenCalled();
  });
});
