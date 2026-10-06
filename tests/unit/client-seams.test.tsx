// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";

vi.mock("next-auth/react", () => ({ signOut: vi.fn(async () => ({})) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

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
