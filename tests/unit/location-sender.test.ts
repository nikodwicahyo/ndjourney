import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMemoryOutbox } from "@/lib/location/outbox";
import { postFix, flushOutbox } from "@/lib/location/sender";
import type { LocationFix } from "@/lib/location/types";

function fix(over: Partial<LocationFix> = {}): LocationFix {
  return {
    clientId: `c-${Math.random().toString(36).slice(2)}`,
    latitude: -6.2,
    longitude: 106.8,
    accuracy: 10,
    heading: null,
    speed: null,
    altitude: null,
    deviceType: "mobile",
    recordedAt: new Date().toISOString(),
    trackingState: "foreground",
    source: "web",
    ...over,
  };
}

const res = (status: number) => ({ ok: status >= 200 && status < 300, status }) as Response;

describe("postFix", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("sends with keepalive and removes the fix on success", async () => {
    const box = createMemoryOutbox();
    const fetchMock = vi.fn(async () => res(200));
    vi.stubGlobal("fetch", fetchMock);
    const f = fix();

    const result = await postFix(f, box);

    expect(result).toBe("ok");
    expect(await box.count()).toBe(0);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/location",
      expect.objectContaining({ method: "POST", keepalive: true }),
    );
  });

  it("keeps the fix when the network throws", async () => {
    const box = createMemoryOutbox();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const f = fix();

    expect(await postFix(f, box)).toBe("retry");
    expect(await box.count()).toBe(1);
  });

  it("keeps the fix on a 5xx and on a 429", async () => {
    const box = createMemoryOutbox();
    vi.stubGlobal("fetch", vi.fn(async () => res(503)));
    expect(await postFix(fix(), box)).toBe("retry");

    vi.stubGlobal("fetch", vi.fn(async () => res(429)));
    expect(await postFix(fix(), box)).toBe("retry");
    expect(await box.count()).toBe(2);
  });

  it("drops a fix the server will never accept", async () => {
    const box = createMemoryOutbox();
    vi.stubGlobal("fetch", vi.fn(async () => res(400)));
    expect(await postFix(fix(), box)).toBe("drop");
    expect(await box.count()).toBe(0);

    vi.stubGlobal("fetch", vi.fn(async () => res(403)));
    expect(await postFix(fix(), box)).toBe("drop");
    expect(await box.count()).toBe(0);
  });
});

describe("flushOutbox", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("does nothing when the queue is empty", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await flushOutbox(createMemoryOutbox());
    expect(result).toEqual({ sent: 0, kept: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends one request for a batch instead of one per fix", async () => {
    const box = createMemoryOutbox();
    await box.enqueue(fix());
    await box.enqueue(fix());
    await box.enqueue(fix());
    const fetchMock = vi.fn(async () => res(200));
    vi.stubGlobal("fetch", fetchMock);

    const result = await flushOutbox(box);

    expect(result).toEqual({ sent: 3, kept: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/location/batch");
    expect(JSON.parse(String(init.body)).fixes).toHaveLength(3);
    expect(await box.count()).toBe(0);
  });

  it("sends a single pending fix through the normal endpoint", async () => {
    const box = createMemoryOutbox();
    await box.enqueue(fix());
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => res(200));
    vi.stubGlobal("fetch", fetchMock);

    await flushOutbox(box);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/location");
    expect(await box.count()).toBe(0);
  });

  it("keeps the whole batch when the flush fails", async () => {
    const box = createMemoryOutbox();
    await box.enqueue(fix());
    await box.enqueue(fix());
    vi.stubGlobal("fetch", vi.fn(async () => res(500)));

    const result = await flushOutbox(box);

    expect(result.kept).toBe(2);
    expect(await box.count()).toBe(2);
  });

  it("is single-flight — concurrent flushes do not double-send", async () => {
    const box = createMemoryOutbox();
    await box.enqueue(fix());
    const gate: { release: (() => void) | null } = { release: null };
    const fetchMock = vi.fn(
      () => new Promise<Response>((resolve) => { gate.release = () => resolve(res(200)); }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const a = flushOutbox(box);
    const b = flushOutbox(box);
    // Let the first flush reach its fetch while it is still in flight.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    gate.release?.();
    await Promise.all([a, b]);
  });
});
