import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("pusher", () => ({ default: vi.fn() }));

// Realtime lazy-init: disabled without env, scoped trigger with env
describe("pusher-server lazy init", () => {
  beforeEach(() => {
    delete process.env.PUSHER_APP_ID;
    delete process.env.NEXT_PUBLIC_PUSHER_APP_KEY;
    delete process.env.PUSHER_SECRET;
    delete process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("disabled without env; trigger is no-op (never throws)", async () => {
    const mod = await import("@/lib/pusher-server");
    expect(mod.getPusherServer()).toBeNull();
    await expect(mod.triggerCoupleEvent("c1", "GALLERY")).resolves.toBeUndefined();
  });

  it("enabled with env triggers scoped channel", async () => {
    process.env.PUSHER_APP_ID = "id";
    process.env.NEXT_PUBLIC_PUSHER_APP_KEY = "key";
    process.env.PUSHER_SECRET = "secret";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "ap1";
    const trigger = vi.fn(async () => ({}));
    const Pusher = (await import("pusher")).default as unknown as ReturnType<typeof vi.fn>;
    Pusher.mockImplementation(function (this: unknown) {
      return { trigger };
    });
    const mod = await import("@/lib/pusher-server");
    const server = mod.getPusherServer() as unknown as { trigger: ReturnType<typeof vi.fn> };
    expect(server).not.toBeNull();
    await mod.triggerCoupleEvent("c1", "LETTERS");
    expect(trigger).toHaveBeenCalledWith("private-couple-c1", "sync-mutate", { scope: "LETTERS", action: "REFRESH" });
  });

  it("trigger failure is swallowed (route still 200)", async () => {
    process.env.PUSHER_APP_ID = "id";
    process.env.NEXT_PUBLIC_PUSHER_APP_KEY = "key";
    process.env.PUSHER_SECRET = "secret";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "ap1";
    const Pusher = (await import("pusher")).default as unknown as ReturnType<typeof vi.fn>;
    Pusher.mockImplementation(function (this: unknown) {
      return { trigger: vi.fn(async () => { throw new Error("pusher down"); }) };
    });
    const mod = await import("@/lib/pusher-server");
    await expect(mod.triggerCoupleEvent("c1", "GALLERY")).resolves.toBeUndefined();
  });
});
