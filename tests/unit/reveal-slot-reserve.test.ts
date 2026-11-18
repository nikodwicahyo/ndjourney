import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Regression guard: a `.reveal-slot` that only relied on
// `contain-intrinsic-size: auto` collapsed to 0px (the empty state was
// remembered as 0), so the last home sections — Daily Love Task included —
// had no reserved space and looked missing on a cold first visit. The
// `min-height` floor is what keeps the slot in the document from first paint.
describe(".reveal-slot", () => {
  const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
  const block = css.match(/\.reveal-slot\s*\{([\s\S]*?)\}/)?.[1] ?? "";

  it("keeps content-visibility for the off-screen skip", () => {
    expect(block).toContain("content-visibility: auto");
  });

  it("reserves the slot height with a min-height floor", () => {
    expect(block).toContain("min-height: var(--reveal-h, 320px)");
  });
});
