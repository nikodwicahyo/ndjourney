import { describe, it, expect } from "vitest";
import { validateUploadRequest, sanitizeFileName } from "@/lib/upload-policy";

// GAL-02
describe("validateUploadRequest", () => {
  it("blocks svg/html by MIME and extension", () => {
    expect(validateUploadRequest({ fileName: "x.svg", fileType: "image/svg+xml", fileSize: 100 }).valid).toBe(false);
    expect(validateUploadRequest({ fileName: "x.html", fileType: "text/html", fileSize: 100 }).valid).toBe(false);
    expect(validateUploadRequest({ fileName: "x.php", fileType: "image/jpeg", fileSize: 100 }).valid).toBe(false);
  });

  it("allows legit image/video within caps", () => {
    expect(validateUploadRequest({ fileName: "a.jpg", fileType: "image/jpeg", fileSize: 1024 }).valid).toBe(true);
    expect(validateUploadRequest({ fileName: "b.mp4", fileType: "video/mp4", fileSize: 50 * 1024 * 1024 }).valid).toBe(true);
  });

  it("rejects oversize + empty + unknown types (GAL-04 edge)", () => {
    expect(validateUploadRequest({ fileName: "big.jpg", fileType: "image/jpeg", fileSize: 11 * 1024 * 1024 }).valid).toBe(false);
    expect(validateUploadRequest({ fileName: "big.mp4", fileType: "video/mp4", fileSize: 101 * 1024 * 1024 }).valid).toBe(false);
    expect(validateUploadRequest({ fileName: "", fileType: "image/jpeg", fileSize: 100 }).valid).toBe(false);
    expect(validateUploadRequest({ fileName: "a.pdf", fileType: "application/pdf", fileSize: 100 }).valid).toBe(false);
  });

  it("sanitizes filenames (no traversal)", () => {
    const out = sanitizeFileName("../../etc/passwd");
    expect(out).not.toContain("..");
    expect(out).toContain("etcpasswd");
    expect(sanitizeFileName("my photo  2024!!.jpg")).toContain("my-photo");
  });
});
