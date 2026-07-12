import { describe, it } from "node:test";
import assert from "node:assert";

const publicRoutes = ["/", "/gallery", "/timeline", "/games", "/notes", "/wishlist", "/login", "/invite", "/auth-error"];

function isPublicPath(pathname: string): boolean {
  return publicRoutes.some((route) => {
    if (route === "/") return pathname === "/";
    return pathname === route || pathname.startsWith(route + "/");
  });
}

describe("Proxy route matching", () => {
  it("allows access to root / by exact match only", () => {
    assert.strictEqual(isPublicPath("/"), true);
  });

  it("denies access to /dashboard when unauthenticated", () => {
    assert.strictEqual(isPublicPath("/dashboard"), false);
  });

  it("denies access to nested private routes", () => {
    assert.strictEqual(isPublicPath("/dashboard/settings"), false);
    assert.strictEqual(isPublicPath("/dashboard/stats"), false);
  });

  it("allows access to /gallery", () => {
    assert.strictEqual(isPublicPath("/gallery"), true);
  });

  it("allows access to nested /gallery paths", () => {
    assert.strictEqual(isPublicPath("/gallery/albums"), true);
    assert.strictEqual(isPublicPath("/gallery/photos"), true);
  });

  it("allows access to /timeline and its subpaths", () => {
    assert.strictEqual(isPublicPath("/timeline"), true);
    assert.strictEqual(isPublicPath("/timeline/2024"), true);
  });

  it("allows access to /games and its subpaths", () => {
    assert.strictEqual(isPublicPath("/games"), true);
    assert.strictEqual(isPublicPath("/games/quiz"), true);
  });

  it("allows access to /notes", () => {
    assert.strictEqual(isPublicPath("/notes"), true);
  });

  it("allows access to /wishlist", () => {
    assert.strictEqual(isPublicPath("/wishlist"), true);
  });

  it("allows access to /login and /invite", () => {
    assert.strictEqual(isPublicPath("/login"), true);
    assert.strictEqual(isPublicPath("/invite"), true);
  });

  it("allows access to /auth-error", () => {
    assert.strictEqual(isPublicPath("/auth-error"), true);
  });

  it("does not treat / as a prefix match for arbitrary paths", () => {
    assert.strictEqual(isPublicPath("/private"), false);
    assert.strictEqual(isPublicPath("/api/data"), false);
    assert.strictEqual(isPublicPath("/_next/data"), false);
  });

  it("does not match /gallery-edit as /gallery", () => {
    assert.strictEqual(isPublicPath("/gallery-edit"), false);
    assert.strictEqual(isPublicPath("/gallery-extra"), false);
  });
});
