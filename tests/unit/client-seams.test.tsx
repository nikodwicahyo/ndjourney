// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth/react", () => ({ signOut: vi.fn(async () => ({})) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/couple", () => ({ getUserCoupleId: vi.fn() }));
vi.mock("@/lib/pusher-server", () => ({ triggerCoupleEvent: vi.fn() }));
vi.mock("pusher", () => ({ default: vi.fn(function (this: unknown) { return this; }) }));

describe("apiFetch transport (+401 auto-logout)", () => {
  it("unwraps JSON, 204 → undefined, 400 throws server message", async () => {
    const { apiFetch, apiFetchRaw } = await import("@/lib/api-fetch");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [1] }), { status: 200 })));
    expect(await apiFetch("http://x")).toEqual({ data: [1] });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    expect(await apiFetch("http://x")).toBeUndefined();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Rusak" }), { status: 400 })));
    await expect(apiFetch("http://x")).rejects.toThrow("Rusak");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok", { status: 200 })));
    expect((await apiFetchRaw("http://x")).status).toBe(200);
  });

  it("401 without ignoreAuthError signs out and throws session message", async () => {
    const { apiFetch } = await import("@/lib/api-fetch");
    const { signOut } = await import("next-auth/react");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "x" }), { status: 401 })));
    await expect(apiFetch("http://x")).rejects.toThrow("Sesi berakhir");
    expect(signOut).toHaveBeenCalled();
  });

  it("401 with ignoreAuthError skips logout", async () => {
    const { apiFetchRaw } = await import("@/lib/api-fetch");
    const { signOut } = await import("next-auth/react");
    vi.mocked(signOut).mockClear();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("u", { status: 401 })));
    const res = await apiFetchRaw("http://x", { ignoreAuthError: true });
    expect(res.status).toBe(401);
    expect(signOut).not.toHaveBeenCalled();
  });
});

describe("withCouple wrapper", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 anon, 404 solo, delegates + triggers scope", async () => {
    const { withCouple } = await import("@/lib/api-helpers");
    const { auth } = await import("@/lib/auth");
    const { getUserCoupleId } = await import("@/lib/couple");
    const { triggerCoupleEvent } = await import("@/lib/pusher-server");

    vi.mocked(auth).mockResolvedValue(null as never);
    const anon = await withCouple(async () => new Response("ok"))(new Request("http://x"));
    expect(anon.status).toBe(401);

    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(getUserCoupleId).mockResolvedValue(null);
    const solo = await withCouple(async () => new Response("ok"))(new Request("http://x"));
    expect(solo.status).toBe(404);

    vi.mocked(getUserCoupleId).mockResolvedValue("c1");
    const handler = vi.fn(async (_req: Request, ctx: { userId: string; coupleId: string }) =>
      Response.json({ userId: ctx.userId, coupleId: ctx.coupleId }),
    );
    const ok = await withCouple(handler, "GALLERY")(new Request("http://x"));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ userId: "u1", coupleId: "c1" });
    expect(triggerCoupleEvent).toHaveBeenCalledWith("c1", "GALLERY");
  });
});

describe("checkStorageVersion", () => {
  it("purges stale namespaced keys once, keeps others", async () => {
    const { checkStorageVersion } = await import("@/lib/app-version");
    localStorage.clear();
    localStorage.setItem("quotes-shown", "[1]");
    localStorage.setItem("spin-history", "x");
    localStorage.setItem("keep-me", "y");
    checkStorageVersion();
    expect(localStorage.getItem("quotes-shown")).toBeNull();
    expect(localStorage.getItem("spin-history")).toBeNull();
    expect(localStorage.getItem("keep-me")).toBe("y");
    expect(localStorage.getItem("ndjourney-storage-version")).toBe("2");
    checkStorageVersion(); // idempotent
    expect(localStorage.getItem("keep-me")).toBe("y");
  });
});
