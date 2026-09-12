import { describe, it, expect } from "vitest";
import { safeTokenEqual } from "@/lib/api-body";
import { escapeHtml, safeAppUrl } from "@/lib/resend";
import { toPublicUser } from "@/lib/format";
import { httpUrl } from "@/lib/validations/http-url";

// SEC-03, LTR-08, SEC-04, SEC-02
describe("security guards", () => {
  it("SEC-03: safeTokenEqual exact/mismatch/empty", () => {
    expect(safeTokenEqual("abc-123", "abc-123")).toBe(true);
    expect(safeTokenEqual("abc-124", "abc-123")).toBe(false);
    expect(safeTokenEqual("", "")).toBe(false);
    expect(safeTokenEqual("short", "much-longer-secret")).toBe(false);
  });

  it("LTR-08: escapeHtml neutralizes injection", () => {
    const out = escapeHtml('"><img src=x onerror=alert(1)>');
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img");
    expect(escapeHtml("Niko & Ucil")).toBe("Niko &amp; Ucil");
  });

  it("safeAppUrl stays same-origin", () => {
    process.env.NEXTAUTH_URL = "https://couple.example.com";
    expect(safeAppUrl("/letters/abc")).toContain("https://couple.example.com/letters/abc");
    expect(safeAppUrl("https://evil.com/x")).toBe("https://couple.example.com");
  });

  it("SEC-04: toPublicUser strips email", () => {
    expect(toPublicUser({ id: "1", name: "N", email: "n@x.com", image: null })).toEqual({ id: "1", name: "N", image: null });
    expect(toPublicUser(null)).toBeNull();
    expect(toPublicUser(undefined)).toBeNull();
  });

  it("SEC-02: httpUrl accepts http(s), rejects javascript:/data:", () => {
    expect(httpUrl().safeParse("https://example.com/a").success).toBe(true);
    expect(httpUrl().safeParse("javascript:alert(1)").success).toBe(false);
    expect(httpUrl().safeParse("data:text/html,<h1>x</h1>").success).toBe(false);
  });
});
