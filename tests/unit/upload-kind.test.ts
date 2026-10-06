import { describe, it, expect } from "vitest";
import { resolveUploadMime, getMaxFileSize } from "@/lib/upload-config";

// Browsers report "" (or octet-stream) for formats they don't recognize —
// desktop Chrome does this for .heic/.heif. The resolver fills the canonical
// MIME from the extension; servers still verify actual bytes via magic numbers.
describe("resolveUploadMime", () => {
  it("fills empty types from known extensions", () => {
    expect(resolveUploadMime("a.heic", "")).toBe("image/heic");
    expect(resolveUploadMime("a.HEIC", "")).toBe("image/heic");
    expect(resolveUploadMime("1784125646814-ka4r1z1x.heif.heic", "")).toBe("image/heic");
    expect(resolveUploadMime("a.heif", "")).toBe("image/heic");
    expect(resolveUploadMime("a.png", "")).toBe("image/png");
    expect(resolveUploadMime("a.mp4", "")).toBe("video/mp4");
    expect(resolveUploadMime("a.mp3", "")).toBe("audio/mpeg");
  });

  it("falls back for bogus-but-present types", () => {
    expect(resolveUploadMime("a.png", "application/octet-stream")).toBe("image/png");
    expect(resolveUploadMime("a.heic", "application/octet-stream")).toBe("image/heic");
  });

  it("keeps genuine media types untouched", () => {
    expect(resolveUploadMime("a.png", "image/png")).toBe("image/png");
    expect(resolveUploadMime("a.weird", "video/mp4")).toBe("video/mp4");
    expect(resolveUploadMime("a.heic", "image/heic")).toBe("image/heic");
  });

  it("passes unknown extensions through for the server to reject", () => {
    expect(resolveUploadMime("a.xyz", "")).toBe("");
    expect(resolveUploadMime("a", "")).toBe("");
  });

  it("resolved heic gets the image size budget", () => {
    expect(getMaxFileSize(resolveUploadMime("a.heic", ""))).toBe(10 * 1024 * 1024);
  });
});
