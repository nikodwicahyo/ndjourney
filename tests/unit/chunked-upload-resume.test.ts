import { describe, it, expect } from "vitest";
import { resolveResumeStart, type UploadSession } from "@/lib/chunked-upload";

const MB = 1024 * 1024;

function session(partial: Partial<UploadSession>): UploadSession {
  return {
    uniqueUploadId: "uq-1",
    publicId: "user-1/1-abc",
    completedChunks: 0,
    uploadedBytes: 0,
    ...partial,
  };
}

describe("resolveResumeStart", () => {
  it("starts at 0 with no session", () => {
    expect(resolveResumeStart(undefined, 10 * MB, 10, 100 * MB)).toEqual({
      startChunk: 0,
      startBytes: 0,
    });
  });

  it("resumes after the last committed chunk", () => {
    expect(
      resolveResumeStart(session({ completedChunks: 3, uploadedBytes: 30 * MB }), 10 * MB, 10, 100 * MB),
    ).toEqual({ startChunk: 3, startBytes: 30 * MB });
  });

  it("never skips the final chunk — its response carries the asset", () => {
    expect(
      resolveResumeStart(session({ completedChunks: 10, uploadedBytes: 100 * MB }), 10 * MB, 10, 100 * MB),
    ).toEqual({ startChunk: 9, startBytes: 90 * MB });
  });

  it("clamps an out-of-range chunk count", () => {
    expect(
      resolveResumeStart(session({ completedChunks: 999, uploadedBytes: 999 * MB }), 10 * MB, 10, 100 * MB),
    ).toEqual({ startChunk: 9, startBytes: 90 * MB });
  });

  it("caps startBytes at fileSize for a partial final chunk", () => {
    // 95MB file at 10MB chunks → 10 chunks, last one 5MB.
    expect(
      resolveResumeStart(session({ completedChunks: 9 }), 10 * MB, 10, 95 * MB),
    ).toEqual({ startChunk: 9, startBytes: 90 * MB });
  });

  it("handles a single-chunk file", () => {
    expect(resolveResumeStart(session({ completedChunks: 5 }), 8 * MB, 1, 8 * MB)).toEqual({
      startChunk: 0,
      startBytes: 0,
    });
  });
});
