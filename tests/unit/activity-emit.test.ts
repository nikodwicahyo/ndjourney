import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/pusher-server", () => ({
  getPusherServer: vi.fn(() => ({ trigger: vi.fn() })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    activityEvent: { create: vi.fn() },
    coupleMember: { findMany: vi.fn() },
    pushSubscription: { findMany: vi.fn(), delete: vi.fn() },
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: { del: vi.fn().mockResolvedValue(1) },
  cacheKey: (...parts: string[]) => parts.join(":"),
}));

vi.mock("web-push", () => ({ sendNotification: vi.fn() }));

import { emitActivity } from "@/lib/activity";
import { getPusherServer } from "@/lib/pusher-server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { sendNotification } from "web-push";
import type Pusher from "pusher";

const baseInput = {
  type: "photo",
  action: "created",
  title: "Foto baru",
  body: "Ada foto baru dari Anda",
  level: "bell" as const,
  href: null as string | null,
};

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.CONTACT_EMAIL;
  vi.clearAllMocks();
  vi.mocked(getPusherServer).mockReturnValue(null);
  vi.mocked(prisma.activityEvent.create).mockResolvedValue({ id: "ev1", createdAt: new Date("2026-11-03T10:00:00Z") } as never);
});

describe("emitActivity", () => {
  it("resolves when web-push fails (fail-open)", async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pk";
    process.env.VAPID_PRIVATE_KEY = "sk";
    vi.mocked(sendNotification).mockRejectedValue(new Error("vapid down"));
    vi.mocked(prisma.coupleMember.findMany).mockResolvedValue([{ userId: "partner" }] as never);
    vi.mocked(prisma.pushSubscription.findMany).mockResolvedValue([{ endpoint: "ep-1", userId: "partner" }] as never);

    await expect(emitActivity("c1", "actor-1", { ...baseInput, level: "both" })).resolves.toBeUndefined();

    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(vi.mocked(prisma.pushSubscription.delete)).not.toHaveBeenCalled();
  });

  it("stores null for non-site-relative hrefs", async () => {
    await emitActivity("c1", "a1", { ...baseInput, type: "note", href: "https://evil.com/x" });
    expect(prisma.activityEvent.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ href: null }) }),
    );

    await emitActivity("c1", "a1", { ...baseInput, type: "note", href: "//evil.com" });
    expect(prisma.activityEvent.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ href: null }) }),
    );

    await emitActivity("c1", "a1", { ...baseInput, type: "note", href: "/notes/123" });
    expect(prisma.activityEvent.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ href: "/notes/123" }) }),
    );
  });

  it("bell sends nothing; both sends to partner subscriptions only", async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pk";
    process.env.VAPID_PRIVATE_KEY = "sk";
    vi.mocked(prisma.coupleMember.findMany).mockResolvedValue([{ userId: "partner" }] as never);
    vi.mocked(prisma.pushSubscription.findMany).mockResolvedValue([{ endpoint: "ep-partner", userId: "partner" }] as never);

    await emitActivity("c1", "actor-1", { ...baseInput, level: "bell" });
    expect(sendNotification).not.toHaveBeenCalled();

    vi.clearAllMocks();
    vi.mocked(getPusherServer).mockReturnValue(null);
    vi.mocked(prisma.activityEvent.create).mockResolvedValue({ id: "ev1", createdAt: new Date("2026-11-03T10:00:00Z") } as never);
    vi.mocked(prisma.coupleMember.findMany).mockResolvedValue([{ userId: "partner" }] as never);
    vi.mocked(prisma.pushSubscription.findMany).mockResolvedValue([{ endpoint: "ep-partner", userId: "partner" }] as never);

    await emitActivity("c1", "actor-1", { ...baseInput, level: "both" });
    expect(prisma.coupleMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ coupleId: "c1", userId: { not: "actor-1" } }),
      }),
    );
    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(sendNotification).toHaveBeenCalledWith(
      "ep-partner",
      JSON.stringify({ title: "Foto baru", body: "Ada foto baru dari Anda", url: null }),
      expect.objectContaining({
        vapidDetails: expect.objectContaining({
          subject: "mailto:app@couple-web",
          publicKey: "pk",
          privateKey: "sk",
        }),
      }),
    );
  });

  it.each([404, 410])("deletes the subscription on WebPushError %s", async (status) => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pk";
    process.env.VAPID_PRIVATE_KEY = "sk";
    const err = new Error("gone") as Error & { statusCode?: number };
    err.statusCode = status;
    vi.mocked(sendNotification).mockRejectedValue(err);
    vi.mocked(prisma.coupleMember.findMany).mockResolvedValue([{ userId: "partner" }] as never);
    vi.mocked(prisma.pushSubscription.findMany).mockResolvedValue([{ endpoint: "ep-partner", userId: "partner" }] as never);

    await emitActivity("c1", "actor-1", { ...baseInput, level: "both" });

    expect(vi.mocked(prisma.pushSubscription.delete)).toHaveBeenCalledWith({ where: { endpoint: "ep-partner" } });
    expect(vi.mocked(prisma.pushSubscription.delete)).toHaveBeenCalledTimes(1);
  });

  it("non-404/410 push errors are logged, not deleted", async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pk";
    process.env.VAPID_PRIVATE_KEY = "sk";
    vi.mocked(sendNotification).mockRejectedValue(new Error("network down"));
    vi.mocked(prisma.coupleMember.findMany).mockResolvedValue([{ userId: "partner" }] as never);
    vi.mocked(prisma.pushSubscription.findMany).mockResolvedValue([{ endpoint: "ep-partner", userId: "partner" }] as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await emitActivity("c1", "actor-1", { ...baseInput, level: "both" });

    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(vi.mocked(prisma.pushSubscription.delete)).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith("[ACTIVITY_PUSH_ERROR]", expect.any(Error));
    errorSpy.mockRestore();
  });

  it("skips push with one warn when VAPID env missing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(prisma.coupleMember.findMany).mockResolvedValue([{ userId: "partner" }] as never);
    vi.mocked(prisma.pushSubscription.findMany).mockResolvedValue([{ endpoint: "ep-partner", userId: "partner" }] as never);

    await emitActivity("c1", "actor-1", { ...baseInput, level: "both" });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("VAPID keys missing"));
    expect(sendNotification).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("triggers pusher with mapped scope and activity payload", async () => {
    const trigger = vi.fn();
    vi.mocked(getPusherServer).mockReturnValue({ trigger } as unknown as Pusher);
    vi.mocked(redis!).del.mockResolvedValue(1);

    await emitActivity("c1", "a1", { ...baseInput, type: "photo", href: "/gallery/1" });

    expect(trigger).toHaveBeenCalledWith("private-couple-c1", "sync-mutate", {
      scope: "GALLERY",
      action: "REFRESH",
      activity: {
        id: "ev1",
        type: "photo",
        action: "created",
        title: "Foto baru",
        body: "Ada foto baru dari Anda",
        href: "/gallery/1",
        createdAt: new Date("2026-11-03T10:00:00Z"),
      },
    });
  });

  it("defaults unknown activity type to DASHBOARD scope", async () => {
    const trigger = vi.fn();
    vi.mocked(getPusherServer).mockReturnValue({ trigger } as unknown as Pusher);
    await emitActivity("c1", "a1", { ...baseInput, type: "surprise" });
    expect(trigger).toHaveBeenCalledWith(
      "private-couple-c1",
      "sync-mutate",
      expect.objectContaining({ scope: "DASHBOARD" }),
    );
  });

  it("swallows pusher errors with [ACTIVITY_PUSHER_ERROR]", async () => {
    vi.mocked(getPusherServer).mockReturnValue({
      trigger: vi.fn().mockRejectedValue(new Error("pusher down")),
    } as unknown as Pusher);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(emitActivity("c1", "a1", { ...baseInput, type: "letter" })).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("[ACTIVITY_PUSHER_ERROR]"), expect.any(Error));
    errorSpy.mockRestore();
  });
});
