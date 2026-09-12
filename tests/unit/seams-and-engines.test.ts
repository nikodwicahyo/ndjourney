import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { coupleMember: { findUnique: vi.fn() }, user: { findMany: vi.fn() } },
}));

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();
vi.stubGlobal("localStorage", localStorageMock);
vi.stubGlobal("navigator", { userAgent: "node-test", maxTouchPoints: 0 });

describe("batch + couple seams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it("batchLoadUsers dedupes, caches, maps records", async () => {
    const { batchLoadUsers, mapUsersToRecords, clearUserCache } = await import("@/lib/batch");
    const { prisma } = await import("@/lib/prisma");
    clearUserCache();
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "u1", name: "A", email: "a@x.com", image: null },
    ] as never);
    const map = await batchLoadUsers(["u1", "u1", null, undefined, "missing"]);
    expect(map.get("u1")?.name).toBe("A");
    expect(prisma.user.findMany).toHaveBeenCalledOnce();
    // second call served from cache — no new query for u1
    await batchLoadUsers(["u1"]);
    expect(prisma.user.findMany).toHaveBeenCalledOnce();
    const rows = mapUsersToRecords(
      [{ id: "l1", authorId: "u1", recipientId: "ghost" }],
      map,
    );
    expect(rows[0].author?.id).toBe("u1");
    expect(rows[0].recipient).toBeNull();
    expect(await batchLoadUsers([])).toEqual(new Map());
  });

  it("getUserCoupleId: id, null, fail-null", async () => {
    const { getUserCoupleId } = await import("@/lib/couple");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.coupleMember.findUnique).mockResolvedValue({ coupleId: "c1" } as never);
    expect(await getUserCoupleId("u1")).toBe("c1");
    vi.mocked(prisma.coupleMember.findUnique).mockResolvedValue(null);
    expect(await getUserCoupleId("u1")).toBeNull();
    vi.mocked(prisma.coupleMember.findUnique).mockRejectedValue(new Error("db down"));
    expect(await getUserCoupleId("u1")).toBeNull();
  });
});

describe("api-body helpers", () => {
  it("parseJsonBody null on malformed; invalidJsonResponse 400; P2002→409; 500 fallback", async () => {
    const { parseJsonBody, invalidJsonResponse, toKnownErrorResponse, handleApiError } = await import("@/lib/api-body");
    expect(await parseJsonBody(new Request("http://x", { method: "POST", body: "{bad" }))).toBeNull();
    expect(await parseJsonBody(new Request("http://x", { method: "POST", body: JSON.stringify({ a: 1 }) }))).toEqual({ a: 1 });
    expect(invalidJsonResponse().status).toBe(400);
    expect(toKnownErrorResponse({ code: "P2002" })?.status).toBe(409);
    expect(toKnownErrorResponse(new SyntaxError("x"))?.status).toBe(400);
    expect(toKnownErrorResponse(new Error("nope"))).toBeNull();
    expect(handleApiError(new Error("boom")).status).toBe(500);
    expect(handleApiError({ code: "P2002" }).status).toBe(409);
  });
});

describe("device + query-keys + upload-config + quotes + fetch-json", () => {
  it("detectDeviceType matrix", async () => {
    const { detectDeviceType } = await import("@/lib/device");
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)", maxTouchPoints: 5 });
    expect(detectDeviceType()).toBe("mobile");
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0)", maxTouchPoints: 5 });
    expect(detectDeviceType()).toBe("tablet");
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Windows NT 10.0)", maxTouchPoints: 0 });
    expect(detectDeviceType()).toBe("desktop");
  });

  it("queryKeys stable + arcade prefix rule", async () => {
    const { queryKeys } = await import("@/lib/query-keys");
    expect(queryKeys.photos.detail("x")).toEqual(["photos", "detail", "x"]);
    expect(queryKeys.letters.list("inbox")).toEqual(["letters", "list", "inbox"]);
    expect(queryKeys.games.arcadeLeaderboardPrefix).toEqual(["games", "arcade-leaderboard"]);
    // concrete key starts with prefix (TanStack prefix invalidation works)
    const concrete = queryKeys.games.arcadeLeaderboard("SLIDING_PUZZLE");
    expect(concrete.slice(0, 2)).toEqual(queryKeys.games.arcadeLeaderboardPrefix);
  });

  it("getChunkSize tiers + totalChunks + formatSpeed", async () => {
    const { getChunkSize, calculateTotalChunks, UploadConfig } = await import("@/lib/upload-config");
    expect(getChunkSize(1024)).toBe(UploadConfig.CHUNK_SIZES.small);
    expect(getChunkSize(100 * 1024 * 1024)).toBe(UploadConfig.CHUNK_SIZES.large);
    expect(getChunkSize(500 * 1024 * 1024)).toBe(UploadConfig.CHUNK_SIZES.xlarge);
    expect(calculateTotalChunks(10 * 1024 * 1024)).toBe(2);
    expect(UploadConfig.MAX_IMAGE_SIZE).toBe(10 * 1024 * 1024);
    expect(UploadConfig.MAX_VIDEO_SIZE).toBe(100 * 1024 * 1024);
  });

  it("getQuoteOfTheDay deterministic per day + QUOTES non-empty", async () => {
    const { getQuoteOfTheDay, QUOTES } = await import("@/lib/quotes");
    expect(QUOTES.length).toBeGreaterThan(20);
    expect(getQuoteOfTheDay()).toBe(getQuoteOfTheDay());
    const all = new Set(QUOTES);
    expect(all.has(getQuoteOfTheDay([0, 1, 2]))).toBe(true);
  });

  it("fetchJson unwraps data, throws server message, list fallback", async () => {
    const { fetchJson, fetchJsonList } = await import("@/lib/fetch-json");
    const ok = new Response(JSON.stringify({ data: { a: 1 } }), { status: 200 });
    vi.stubGlobal("fetch", vi.fn(async () => ok));
    expect(await fetchJson("http://x")).toEqual({ a: 1 });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Gagal" }), { status: 400 })));
    await expect(fetchJson("http://x")).rejects.toThrow("Gagal");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })));
    expect(await fetchJsonList("http://x")).toEqual([]);
  });
});

describe("block-blast shapes engine", () => {
  it("shapes consistent + placement + line clear", async () => {
    const shapes = await import("@/lib/game-block-shapes");
    const all = shapes.getAllShapes();
    expect(all.length).toBeGreaterThan(5);
    for (const s of all) {
      expect(s.cells).toHaveLength(s.width * 0 + s.cells.length); // sanity
      expect(s.cells.length).toBeGreaterThan(0);
      const maxR = Math.max(...s.cells.map((c) => c.row));
      const maxC = Math.max(...s.cells.map((c) => c.col));
      expect(maxR + 1).toBe(s.height);
      expect(maxC + 1).toBe(s.width);
    }
    const grid = new Array(64).fill(false);
    const one = all.find((s) => s.id === "1x1")!;
    const cells = shapes.getAbsoluteCells(one, 0, 0)!;
    expect(shapes.getAbsoluteCells(one, 7, 7)).not.toBeNull();
    expect(shapes.getAbsoluteCells(one, 8, 0)).toBeNull();
    expect(shapes.canPlace(grid, cells)).toBe(true);
    const placed = shapes.placeBlock(grid, cells);
    expect(shapes.countFilled(placed)).toBe(1);
    expect(shapes.canPlace(placed, cells)).toBe(false);
    const fullRow = new Array(64).fill(false).map((_, i) => Math.floor(i / 8) === 0);
    expect(shapes.isRowFull(fullRow, 0)).toBe(true);
    expect(shapes.isRowFull(fullRow, 1)).toBe(false);
    const cleared = shapes.clearRow(fullRow, 0);
    expect(shapes.countFilled(cleared)).toBe(0);
    expect(shapes.findFullLines(fullRow)).toEqual({ rows: [0], cols: [] });
    expect(shapes.cellBackgroundPosition(0, 0)).toContain("px");
  });
});

describe("useAppStore state machine", () => {
  it("sidebar/modal/theme/loading transitions", async () => {
    const { useAppStore } = await import("@/stores/useAppStore");
    const s0 = useAppStore.getState();
    expect(s0.sidebarOpen).toBe(false);
    expect(s0.activeModal).toBeNull();
    useAppStore.getState().toggleSidebar();
    expect(useAppStore.getState().sidebarOpen).toBe(true);
    useAppStore.getState().setSidebarOpen(false);
    useAppStore.getState().openModal("upload-photo", { albumId: "a1" });
    expect(useAppStore.getState().activeModal).toBe("upload-photo");
    expect(useAppStore.getState().modalData).toEqual({ albumId: "a1" });
    useAppStore.getState().closeModal();
    expect(useAppStore.getState().activeModal).toBeNull();
    useAppStore.getState().setTheme("dark");
    expect(useAppStore.getState().theme).toBe("dark");
    useAppStore.getState().setLoading(true);
    expect(useAppStore.getState().isLoading).toBe(true);
    useAppStore.getState().setUser({ id: "u1", name: "A", email: "a@x.com", image: null } as never);
    expect(useAppStore.getState().user?.id).toBe("u1");
  });
});
