import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { createOutbox, createMemoryOutbox } from "@/lib/location/outbox";
import type { LocationFix } from "@/lib/location/types";

let seq = 0;
function fix(over: Partial<LocationFix> = {}): LocationFix {
  seq += 1;
  return {
    clientId: `fix-${seq}`,
    latitude: -6.2,
    longitude: 106.8,
    accuracy: 10,
    heading: null,
    speed: null,
    altitude: null,
    deviceType: "mobile",
    recordedAt: new Date(1_700_000_000_000 + seq * 1000).toISOString(),
    trackingState: "foreground",
    source: "web",
    ...over,
  };
}

describe("outbox (IndexedDB)", () => {
  let db = 0;
  const make = () => createOutbox({ dbName: `outbox-test-${++db}` });

  it("stores a fix and lists it back", async () => {
    const box = make();
    const a = fix();
    await box.enqueue(a);
    const list = await box.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ clientId: a.clientId, latitude: a.latitude });
    expect(await box.count()).toBe(1);
  });

  it("lists oldest first", async () => {
    const box = make();
    const a = fix({ clientId: "old" });
    const b = fix({ clientId: "new" });
    await box.enqueue(b);
    await box.enqueue(a);
    const list = await box.list();
    expect(list.map((f) => f.clientId)).toEqual(["new", "old"]);
  });

  it("is idempotent per clientId — a retry does not duplicate", async () => {
    const box = make();
    const a = fix({ clientId: "same" });
    await box.enqueue(a);
    await box.enqueue(a);
    expect(await box.count()).toBe(1);
  });

  it("removes delivered fixes", async () => {
    const box = make();
    await box.enqueue(fix({ clientId: "a" }));
    await box.enqueue(fix({ clientId: "b" }));
    await box.remove(["a"]);
    expect((await box.list()).map((f) => f.clientId)).toEqual(["b"]);
  });

  it("caps the queue and drops the oldest entries", async () => {
    const box = createOutbox({ dbName: `outbox-cap-${++db}`, maxItems: 3 });
    for (const id of ["a", "b", "c", "d", "e"]) {
      await box.enqueue(fix({ clientId: id }));
    }
    expect(await box.count()).toBe(3);
    expect((await box.list()).map((f) => f.clientId)).toEqual(["c", "d", "e"]);
  });

  it("respects the list limit", async () => {
    const box = make();
    for (const id of ["a", "b", "c"]) await box.enqueue(fix({ clientId: id }));
    expect((await box.list(2)).map((f) => f.clientId)).toEqual(["a", "b"]);
  });

  it("clears everything on logout", async () => {
    const box = make();
    await box.enqueue(fix());
    await box.clear();
    expect(await box.count()).toBe(0);
  });
});

describe("outbox (memory fallback)", () => {
  it("behaves like the real queue when IndexedDB is unavailable", async () => {
    const box = createMemoryOutbox(2);
    await box.enqueue(fix({ clientId: "a" }));
    await box.enqueue(fix({ clientId: "b" }));
    await box.enqueue(fix({ clientId: "c" }));
    expect(await box.count()).toBe(2);
    expect((await box.list()).map((f) => f.clientId)).toEqual(["b", "c"]);
    await box.remove(["b"]);
    expect((await box.list()).map((f) => f.clientId)).toEqual(["c"]);
    await box.clear();
    expect(await box.count()).toBe(0);
  });
});
