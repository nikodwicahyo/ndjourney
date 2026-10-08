import { describe, it, expect } from "vitest";
import {
  appendSeen,
  pruneSeen,
  isExhausted,
  loadSeenIds,
  MAX_EXCLUDE_IDS,
} from "@/lib/game-deck";

describe("appendSeen", () => {
  it("de-duplicates across rounds", () => {
    expect(appendSeen(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("returns same ref on empty append (no pointless refetch)", () => {
    const seen = ["a"];
    expect(appendSeen(seen, [])).toBe(seen);
  });

  it("caps at MAX_EXCLUDE_IDS, keeping most recent", () => {
    const seen = Array.from({ length: MAX_EXCLUDE_IDS }, (_, i) => `o${i}`);
    const next = appendSeen(seen, ["new1", "new2"]);
    expect(next).toHaveLength(MAX_EXCLUDE_IDS);
    expect(next.slice(-2)).toEqual(["new1", "new2"]);
    expect(next).not.toContain("o0");
  });
});

describe("pruneSeen", () => {
  it("drops ids that left the bank", () => {
    const items = [{ id: "a" }, { id: "gone" }, { id: "b" }];
    expect(pruneSeen(items, (i) => i.id, new Set(["a", "b"]))).toEqual([
      { id: "a" },
      { id: "b" },
    ]);
  });
});

describe("isExhausted", () => {
  it("requires a non-empty bank", () => {
    expect(isExhausted(0, 0)).toBe(false);
    expect(isExhausted(5, 0)).toBe(false);
  });

  it("true once every item seen", () => {
    expect(isExhausted(10, 10)).toBe(true);
    expect(isExhausted(12, 10)).toBe(true);
    expect(isExhausted(9, 10)).toBe(false);
  });
});

describe("loadSeenIds", () => {
  it("returns [] outside the browser", () => {
    expect(loadSeenIds("whatever")).toEqual([]);
  });
});
