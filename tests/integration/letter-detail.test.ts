import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  letter: { findUnique: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/redis", () => ({
  getCached: vi.fn(async () => null),
  setCached: vi.fn(async () => {}),
  cacheKey: (...p: string[]) => p.join(":"),
}));
vi.mock("@/lib/batch", () => ({
  batchLoadUsers: vi.fn(async (ids: string[]) =>
    new Map(ids.map((id) => [id, { id, name: "P", image: null }])),
  ),
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/couple", () => ({ getUserCoupleId: vi.fn(async () => null) }));
vi.mock("@/lib/pusher-server", () => ({ triggerCoupleEvent: vi.fn() }));

const { getLetterDetail } = await import("@/lib/queries/letter");
const { GET } = await import("@/app/api/letters/[id]/route");
const { auth } = await import("@/lib/auth");

// cuid() rejects hyphens — use cuid-shaped ids
const ME = "cjld2cjxh0000qz8n0p3q4w5e1";
const PARTNER = "cjld2cjxh0000qz8n0p3q4w5e2";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "l1",
    title: "Hai",
    content: "<p>isi surat</p>",
    authorId: ME,
    recipientId: PARTNER,
    isTimeCapsule: false,
    unlockAt: null,
    isOpened: false,
    openedAt: null,
    mood: "LOVE",
    isPublic: false,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    ...overrides,
  };
}

async function detail(userId: string) {
  const result = await getLetterDetail(userId, "l1");
  if (result.status !== "ok") throw new Error(`unexpected status: ${result.status}`);
  return result.data as Record<string, unknown>;
}

describe("letter detail payload contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: ME } } as never);
  });

  it("returns the letter itself, not the HTTP { data } envelope (SSR hydration shape)", async () => {
    prismaMock.letter.findUnique.mockResolvedValue(row());

    const data = await detail(ME);

    expect(data.id).toBe("l1");
    expect(data.content).toBe("<p>isi surat</p>");
    expect("data" in data).toBe(false);
  });

  it("returns a locked capsule as a partial payload without content/recipient", async () => {
    const unlockAt = new Date(Date.now() + 86_400_000);
    prismaMock.letter.findUnique.mockResolvedValue(
      row({ isTimeCapsule: true, unlockAt }),
    );

    const data = await detail(PARTNER);

    expect(data.content).toBeUndefined();
    expect(data.recipient).toBeUndefined();
    expect(data.isTimeCapsule).toBe(true);
    expect(data.isOpened).toBe(false);
    expect(data.unlockAt).toBe(unlockAt.toISOString());
  });

  it("returns content once the capsule unlock time has passed", async () => {
    prismaMock.letter.findUnique.mockResolvedValue(
      row({ isTimeCapsule: true, unlockAt: new Date(Date.now() - 1_000) }),
    );

    const data = await detail(PARTNER);

    expect(data.content).toBe("<p>isi surat</p>");
  });

  it("returns content for a capsule that was already opened", async () => {
    prismaMock.letter.findUnique.mockResolvedValue(
      row({
        isTimeCapsule: true,
        unlockAt: new Date(Date.now() + 86_400_000),
        isOpened: true,
        openedAt: new Date(),
      }),
    );

    const data = await detail(PARTNER);

    expect(data.content).toBe("<p>isi surat</p>");
  });

  it("never locks a non-capsule with a stray unlockAt", async () => {
    prismaMock.letter.findUnique.mockResolvedValue(
      row({ isTimeCapsule: false, unlockAt: new Date(Date.now() + 86_400_000) }),
    );

    const data = await detail(PARTNER);

    expect(data.content).toBe("<p>isi surat</p>");
  });

  it("GET wraps the payload in exactly one { data } envelope", async () => {
    prismaMock.letter.findUnique.mockResolvedValue(row());

    const res = await GET(new Request("http://localhost/api/letters/l1"), {
      params: Promise.resolve({ id: "l1" }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.id).toBe("l1");
    expect(body.data.content).toBe("<p>isi surat</p>");
    expect(body.data.data).toBeUndefined();
  });

  it("GET keeps locked capsules content-free", async () => {
    prismaMock.letter.findUnique.mockResolvedValue(
      row({ isTimeCapsule: true, unlockAt: new Date(Date.now() + 86_400_000) }),
    );
    vi.mocked(auth).mockResolvedValue({ user: { id: PARTNER } } as never);

    const res = await GET(new Request("http://localhost/api/letters/l1"), {
      params: Promise.resolve({ id: "l1" }),
    });
    const body = await res.json();

    expect(body.data.content).toBeUndefined();
    expect(body.data.isOpened).toBe(false);
  });
});
