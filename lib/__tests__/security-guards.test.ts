import { describe, it } from "node:test";
import assert from "node:assert";
import { safeTokenEqual } from "@/lib/api-body";
import { escapeHtml } from "@/lib/resend";
import { checkMagicBytes } from "@/lib/upload-magic";
import { validateUploadRequest } from "@/lib/upload-policy";
import { toPublicUser } from "@/lib/format";
import { httpUrl } from "@/lib/validations/http-url";

describe("safeTokenEqual", () => {
  it("accepts exact match", () => {
    assert.strictEqual(safeTokenEqual("abc-123", "abc-123"), true);
  });
  it("rejects mismatch and empty", () => {
    assert.strictEqual(safeTokenEqual("abc-124", "abc-123"), false);
    assert.strictEqual(safeTokenEqual("", ""), false);
    assert.strictEqual(safeTokenEqual("short", "much-longer-secret"), false);
  });
});

describe("escapeHtml", () => {
  it("neutralizes HTML injection payload", () => {
    const out = escapeHtml('"><img src=x onerror=alert(1)>');
    assert.ok(!out.includes("<img"), out);
    assert.ok(out.includes("&lt;img"), out);
  });
  it("leaves plain text intact", () => {
    assert.strictEqual(escapeHtml("Niko & Ucil"), "Niko &amp; Ucil");
  });
});

describe("httpUrl", () => {
  it("accepts http(s)", () => {
    assert.ok(httpUrl().safeParse("https://example.com/a").success);
  });
  it("rejects javascript:/data: URLs", () => {
    assert.ok(!httpUrl().safeParse("javascript:alert(1)").success);
    assert.ok(!httpUrl().safeParse("data:text/html,<h1>x</h1>").success);
  });
});

describe("checkMagicBytes", () => {
  it("accepts real PNG/JPEG headers", () => {
    assert.strictEqual(checkMagicBytes(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]), "image/png"), true);
    assert.strictEqual(checkMagicBytes(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]), "image/jpeg"), true);
  });
  it("rejects spoofed content and MP3-without-header stays strict", () => {
    assert.strictEqual(checkMagicBytes(Buffer.from("GIF89a12345678"), "image/png"), false);
    assert.strictEqual(checkMagicBytes(Buffer.from([0x49, 0x44, 0x33, 0, 0, 0, 0, 0]), "audio/mpeg"), true);
  });
});

describe("validateUploadRequest", () => {
  it("blocks SVG/HTML by MIME and extension", () => {
    assert.strictEqual(validateUploadRequest({ fileName: "x.svg", fileType: "image/svg+xml", fileSize: 100 }).valid, false);
    assert.strictEqual(validateUploadRequest({ fileName: "x.html", fileType: "text/html", fileSize: 100 }).valid, false);
  });
  it("still allows legit image/video within caps", () => {
    assert.strictEqual(validateUploadRequest({ fileName: "a.jpg", fileType: "image/jpeg", fileSize: 1024 }).valid, true);
    assert.strictEqual(validateUploadRequest({ fileName: "b.mp4", fileType: "video/mp4", fileSize: 50 * 1024 * 1024 }).valid, true);
  });
});

describe("toPublicUser", () => {
  it("strips email, keeps display fields", () => {
    assert.deepStrictEqual(
      toPublicUser({ id: "1", name: "N", email: "n@x.com", image: null }),
      { id: "1", name: "N", image: null },
    );
    assert.strictEqual(toPublicUser(null), null);
    assert.strictEqual(toPublicUser(undefined), null);
  });
});
