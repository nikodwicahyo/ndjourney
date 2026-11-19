import { describe, it, expect } from "vitest";
import { escapeHtml } from "@/lib/escape-html";

describe("escapeHtml", () => {
  it("escapes markup characters", () => {
    expect(escapeHtml(`<img src=x onerror="alert(1)">`)).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
  });

  it("escapes ampersands and single quotes", () => {
    expect(escapeHtml(`Tom & Jerry's`)).toBe("Tom &amp; Jerry&#39;s");
  });

  it("leaves plain text untouched", () => {
    expect(escapeHtml("Jl. Sudirman")).toBe("Jl. Sudirman");
  });
});
