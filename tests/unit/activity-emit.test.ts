import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/pusher-server", () => ({
  getPusherServer: vi.fn(() => ({ trigger: vi.fn() })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    activityEvent: { create: vi.fn(), findFirst: vi.fn() },
    coupleMember: { findMany: vi.fn() },
    pushSubscription: { findMany: vi.fn(), delete: vi.fn() },
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: { del: vi.fn().mockResolvedValue(1) },
  cacheKey: (...parts: string[]) => parts.join(":"),
}));

vi.mock("web-push", () => ({ sendNotification: vi.fn() }));

import { emitActivity, notifyLocationReonline } from "@/lib/activity";
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

    // backslashes / control bytes would let router.push leave the origin
    for (const bad of ["/\\evil.com", "/notes/\u0000x", "/notes/\nx"]) {
      await emitActivity("c1", "a1", { ...baseInput, type: "note", href: bad });
      expect(prisma.activityEvent.create).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ href: null }) }),
      );
    }
  });

  it("bell sends nothing; both sends to partner subscriptions only", async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pk";
    process.env.VAPID_PRIVATE_KEY = "sk";
    vi.mocked(prisma.coupleMember.findMany).mockResolvedValue([{ userId: "partner" }] as never);
    vi.mocked(prisma.pushSubscription.findMany).mockResolvedValue([
      { endpoint: "ep-partner", p256dh: "p256dh-value", auth: "auth-value", userId: "partner" },
    ] as never);

    await emitActivity("c1", "actor-1", { ...baseInput, level: "bell" });
    expect(sendNotification).not.toHaveBeenCalled();

    vi.clearAllMocks();
    vi.mocked(getPusherServer).mockReturnValue(null);
    vi.mocked(prisma.activityEvent.create).mockResolvedValue({ id: "ev1", createdAt: new Date("2026-11-03T10:00:00Z") } as never);
    vi.mocked(prisma.coupleMember.findMany).mockResolvedValue([{ userId: "partner" }] as never);
    vi.mocked(prisma.pushSubscription.findMany).mockResolvedValue([
      { endpoint: "ep-partner", p256dh: "p256dh-value", auth: "auth-value", userId: "partner" },
    ] as never);

    await emitActivity("c1", "actor-1", { ...baseInput, level: "both" });
    expect(prisma.coupleMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ coupleId: "c1", userId: { not: "actor-1" } }),
      }),
    );
    expect(sendNotification).toHaveBeenCalledTimes(1);
    // web-push needs the subscription object, not the bare endpoint string.
    expect(sendNotification).toHaveBeenCalledWith(
      {
        endpoint: "ep-partner",
        keys: { p256dh: "p256dh-value", auth: "auth-value" },
      },
      JSON.stringify({ title: "Foto baru", body: "Ada foto baru dari Anda", url: null }),
      expect.objectContaining({
        timeout: 5000,
        vapidDetails: expect.objectContaining({
          subject: "mailto:app@couple-web",
          publicKey: "pk",
          privateKey: "sk",
        }),
      }),
    );
  });

  it("fans out to every partner subscription and prunes only the dead one", async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pk";
    process.env.VAPID_PRIVATE_KEY = "sk";
    vi.mocked(prisma.coupleMember.findMany).mockResolvedValue([{ userId: "partner" }] as never);
    vi.mocked(prisma.pushSubscription.findMany).mockResolvedValue([
      { endpoint: "ep-live", p256dh: "k1", auth: "a1", userId: "partner" },
      { endpoint: "ep-gone", p256dh: "k2", auth: "a2", userId: "partner" },
    ] as never);
    const gone = new Error("gone") as Error & { statusCode?: number };
    gone.statusCode = 410;
    vi.mocked(sendNotification)
      .mockResolvedValueOnce({ statusCode: 201 } as never)
      .mockRejectedValueOnce(gone);

    await emitActivity("c1", "actor-1", { ...baseInput, level: "both" });

    expect(sendNotification).toHaveBeenCalledTimes(2);
    expect(vi.mocked(prisma.pushSubscription.delete)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(prisma.pushSubscription.delete)).toHaveBeenCalledWith({
      where: { endpoint: "ep-gone" },
    });
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

// "Online" means the device GPS is posting again — the same 60 s threshold the
// location card renders as "Offline". A normal 8–30 s ping must stay silent.
describe("notifyLocationReonline", () => {
  const NOW = new Date("2026-11-10T10:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pk";
    process.env.VAPID_PRIVATE_KEY = "sk";
    vi.mocked(prisma.coupleMember.findMany).mockResolvedValue([]);
    vi.mocked(prisma.activityEvent.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.activityEvent.create).mockResolvedValue({ id: "ev-loc", createdAt: NOW } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("skips a ping whose previous fix is still fresh", async () => {
    await notifyLocationReonline("c1", "a1", "Niko", new Date(NOW.getTime() - 30_000));

    expect(prisma.activityEvent.findFirst).not.toHaveBeenCalled();
    expect(prisma.activityEvent.create).not.toHaveBeenCalled();
  });

  it("notifies the partner when GPS comes back after the stale threshold", async () => {
    await notifyLocationReonline("c1", "a1", "Niko", new Date(NOW.getTime() - 120_000));

    expect(prisma.activityEvent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { coupleId: "c1", actorId: "a1", type: "location" } }),
    );
    expect(prisma.activityEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "location",
        action: "updated",
        title: "Partner online",
        body: "Niko kembali online — GPS aktif, lokasi live",
        href: "/location",
        level: "both",
      }),
    });
  });

  it("suppresses a re-online inside the 5-minute cooldown", async () => {
    vi.mocked(prisma.activityEvent.findFirst).mockResolvedValue({
      createdAt: new Date(NOW.getTime() - 60_000),
    } as never);

    await notifyLocationReonline("c1", "a1", "Niko", new Date(NOW.getTime() - 120_000));

    expect(prisma.activityEvent.create).not.toHaveBeenCalled();
  });

  it("lets the first fix through once the share-on event ages past the cooldown", async () => {
    vi.mocked(prisma.activityEvent.findFirst).mockResolvedValue({
      createdAt: new Date(NOW.getTime() - 6 * 60_000),
    } as never);

    await notifyLocationReonline("c1", "a1", "Niko", null);

    expect(prisma.activityEvent.create).toHaveBeenCalledTimes(1);
  });

  it("fails open when the cooldown lookup errors", async () => {
    vi.mocked(prisma.activityEvent.findFirst).mockRejectedValue(new Error("db down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      notifyLocationReonline("c1", "a1", null, new Date(NOW.getTime() - 120_000)),
    ).resolves.toBeUndefined();

    expect(prisma.activityEvent.create).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith("[LOCATION_REONLINE_ERROR]", expect.any(Error));
    errorSpy.mockRestore();
  });
});
