import { describe, it, expect } from "vitest";
import { checkMagicBytes } from "@/lib/upload-magic";

// GAL-03
describe("checkMagicBytes", () => {
  it("accepts real PNG/JPEG headers", () => {
    expect(checkMagicBytes(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]), "image/png")).toBe(true);
    expect(checkMagicBytes(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]), "image/jpeg")).toBe(true);
  });

  it("rejects spoofed content", () => {
    expect(checkMagicBytes(Buffer.from("GIF89a12345678"), "image/png")).toBe(false);
    expect(checkMagicBytes(Buffer.from("<html><body>"), "image/jpeg")).toBe(false);
  });

  it("passes unknown types through (policy allowlist decides)", () => {
    expect(checkMagicBytes(Buffer.from("anything"), "image/heif-unknown")).toBe(true);
  });
});
