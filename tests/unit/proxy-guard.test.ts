import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
// T-03: exercise the REAL guard via the shared pure module (proxy.ts
// re-exports these) — a local copy cannot catch regressions in the real one.
import { isPublicPath, isAuthPath } from "@/lib/route-guards";

// AUTH-06: route guard matrix (mirror proxy.ts + legacy __tests__/proxy.test.ts)
describe("proxy route guards", () => {
  it("treats / as exact-match public", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/private")).toBe(false);
    expect(isPublicPath("/api/data")).toBe(false);
  });

  it("allows public gallery/timeline/letters/games/notes/wishlist subpaths", () => {
    expect(isPublicPath("/gallery")).toBe(true);
    expect(isPublicPath("/gallery/albums")).toBe(true);
    expect(isPublicPath("/timeline/2024")).toBe(true);
    expect(isPublicPath("/letters/abc")).toBe(true);
    expect(isPublicPath("/games/quiz")).toBe(true);
    expect(isPublicPath("/notes")).toBe(true);
    expect(isPublicPath("/wishlist")).toBe(true);
  });

  it("does not prefix-match lookalikes", () => {
    expect(isPublicPath("/gallery-edit")).toBe(false);
    expect(isPublicPath("/gallery-extra")).toBe(false);
  });

  it("keeps dashboard private", () => {
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/dashboard/settings")).toBe(false);
  });

  it("recognises auth routes", () => {
    expect(isAuthPath("/login")).toBe(true);
    expect(isAuthPath("/invite/xyz")).toBe(true);
    expect(isAuthPath("/auth-error")).toBe(true);
    expect(isAuthPath("/dashboard")).toBe(false);
  });

  it("implementation matches proxy.ts source (no drift)", () => {
    const src = readFileSync(join(process.cwd(), "proxy.ts"), "utf-8");
    expect(src).toContain("@/lib/route-guards");
    expect(src).toContain("isPublicPath");
    expect(src).toContain("isAuthPath");
  });
});
