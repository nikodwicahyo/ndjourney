import { describe, it, expect } from "vitest";
import { selectPublicPhotos } from "@/lib/utils";

// Games are public: only public media, never private (server already scopes
// visibility=public; this is the client defense-in-depth for stale cache).
describe("selectPublicPhotos", () => {
  it("drops explicit private rows", () => {
    const pub = { id: "a", isPublic: true };
    const priv = { id: "b", isPublic: false };
    expect(selectPublicPhotos([pub, priv])).toEqual([pub]);
  });

  it("treats missing isPublic (stale cache) as public", () => {
    const legacy = { id: "old" };
    const priv = { id: "p", isPublic: false };
    expect(selectPublicPhotos([legacy, priv])).toEqual([legacy]);
  });

  it("empty in → empty out", () => {
    expect(selectPublicPhotos([])).toEqual([]);
  });
});
