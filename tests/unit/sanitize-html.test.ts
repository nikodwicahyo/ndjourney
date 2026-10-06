import { describe, it, expect } from "vitest";
import { sanitizeStoredHtml } from "@/lib/sanitize-html";

describe("SEC-006: server-side stored-HTML sanitize", () => {
  it("strips script/iframe/img/svg and event handlers", () => {
    const out = sanitizeStoredHtml(
      `<p onclick="evil()">Hai</p><script>alert(1)</script><img src=x onerror=alert(1)><svg onload=alert(1)><a href="https://x.com">ok</a>`,
    );
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<img");
    expect(out).not.toContain("<svg");
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("onerror");
    expect(out).toContain("<p>Hai</p>");
    expect(out).toContain('href="https://x.com"');
  });

  it("neutralizes javascript:/data: hrefs and strips style", () => {
    const out = sanitizeStoredHtml(
      `<a href="javascript:alert(1)">x</a><a href="data:text/html;base64,xxx">y</a><p style="position:fixed">z</p>`,
    );
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("data:");
    expect(out).not.toContain("style=");
    expect(out).toContain("<p>z</p>");
  });

  it("keeps Tiptap formatting tags", () => {
    const html = `<h2>T</h2><ul><li><strong>a</strong> <em>b</em></li></ul><blockquote>q</blockquote>`;
    expect(sanitizeStoredHtml(html)).toBe(html);
  });
});
