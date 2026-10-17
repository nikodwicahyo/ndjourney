import { describe, it, expect, vi, beforeEach } from "vitest";
import { UploadQueue } from "@/lib/upload-queue";
import { uploadFileSimple, type ChunkUploadProgress, type UploadFileOptions } from "@/lib/chunked-upload";

vi.mock("@/lib/chunked-upload", () => ({
  uploadFileSimple: vi.fn(),
}));

const noop = () => {};

function makeQueue(maxConcurrency: number) {
  return new UploadQueue({
    maxConcurrency,
    chunkSize: 5 * 1024 * 1024,
    folder: "test",
    onProgress: noop,
    onComplete: noop,
    onError: noop,
    onAllComplete: noop,
  });
}

function progress(overrides: Partial<ChunkUploadProgress>): ChunkUploadProgress {
  return {
    fileName: "clip.mov",
    fileSize: 100,
    loaded: 0,
    total: 100,
    uploadedBytes: 0,
    totalChunks: 1,
    completedChunks: 0,
    currentChunk: 1,
    progress: 0,
    speed: 0,
    eta: 0,
    status: "uploading",
    ...overrides,
  };
}

function makeFile(size = 100) {
  return new File([new Uint8Array(size)], "clip.mov", { type: "video/quicktime" });
}

/** A file above the single-request threshold, without allocating the bytes. */
function makeChunkedFile(size = 20 * 1024 * 1024) {
  const f = new File([new Uint8Array(0)], "clip.mov", { type: "video/quicktime" });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

function abortError(message = "Upload aborted") {
  const err = new Error(message) as Error & { isAborted?: boolean };
  err.isAborted = true;
  return err;
}

const mocked = vi.mocked(uploadFileSimple);

beforeEach(() => {
  mocked.mockReset();
});

describe("UploadQueue pause / resume", () => {
  it("pauses a queued (not yet started) upload and settles its promise", async () => {
    const q = makeQueue(0); // never auto-starts, so the item stays pending
    const p = q.add(makeFile(), "u-1/clip", "video");
    const id = q.getAll()[0].id;

    expect(q.pauseUpload(id)).toBe(true);
    expect((await p).status).toBe("paused");
    expect(q.getById(id)?.status).toBe("paused");
  });

  it("resumes a paused upload, keeping its resume session", async () => {
    const q = makeQueue(0);
    const p = q.add(makeFile(), "u-1/clip", "video");
    const id = q.getAll()[0].id;
    q.getById(id)!.session = {
      uniqueUploadId: "uq-1",
      publicId: "u-1/clip",
      completedChunks: 2,
      uploadedBytes: 40,
    };
    await q.pauseUpload(id);
    await p;

    const done = q.resetToPending(id);
    expect(done).not.toBeNull();
    const upload = q.getById(id)!;
    expect(upload.status).toBe("pending");
    expect(upload.session?.uploadedBytes).toBe(40); // session survives the pause
    expect(upload.progress.percent).toBe(40); // resumes from committed bytes, not 0
    q.remove(id);
  });

  it("pauses an in-flight upload and snaps progress back to the committed bytes", async () => {
    const q = makeQueue(1);
    let started = false;

    mocked.mockImplementation((_file, onProgress, signal) => {
      started = true;
      onProgress(progress({ loaded: 55 }));
      return new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          const err = new Error("Upload aborted") as Error & { isAborted?: boolean };
          err.isAborted = true;
          reject(err);
        });
      });
    });

    const p = q.add(makeFile(100), "u-1/clip", "video");
    for (let i = 0; i < 50 && !started; i++) {
      await new Promise((r) => setTimeout(r, 0));
    }
    expect(started).toBe(true);

    const id = q.getAll()[0].id;
    // 40 bytes were durably committed even though 55 were in flight.
    q.getById(id)!.session = {
      uniqueUploadId: "uq-1",
      publicId: "u-1/clip",
      completedChunks: 0,
      uploadedBytes: 40,
    };

    expect(q.pauseUpload(id)).toBe(true);
    const stopped = await p;
    expect(stopped.status).toBe("paused");
    expect(stopped.progress.loaded).toBe(40);
    expect(stopped.progress.percent).toBe(40);
  });

  it("pauses a chunked upload at a chunk boundary, keeping the session", async () => {
    const q = makeQueue(1);
    let captured: UploadFileOptions | undefined;
    let abortedMidChunk = false;

    mocked.mockImplementation(async (_file, _onProgress, signal, _config, options) => {
      captured = options;
      // Simulate the real chunk loop: transfer, then consult shouldStop at the
      // committed-chunk boundary.
      for (let i = 0; i < 500; i++) {
        if (signal?.aborted) {
          abortedMidChunk = true;
          break;
        }
        if (options?.shouldStop?.()) throw abortError("Upload paused");
        await new Promise((r) => setTimeout(r, 0));
      }
      throw abortError("Upload paused");
    });

    const p = q.add(makeChunkedFile(), "u-1/clip", "video");
    for (let i = 0; i < 50 && !captured; i++) {
      await new Promise((r) => setTimeout(r, 0));
    }
    const id = q.getAll()[0].id;
    // Two 5MiB chunks are durably committed before the pause.
    q.getById(id)!.session = {
      uniqueUploadId: "uq-1",
      publicId: "u-1/clip",
      completedChunks: 2,
      uploadedBytes: 10 * 1024 * 1024,
    };

    expect(q.pauseUpload(id)).toBe(true);
    const stopped = await p;
    expect(stopped.status).toBe("paused");
    // The in-flight chunk was never aborted mid-transfer → no bytes thrown away.
    expect(abortedMidChunk).toBe(false);
    expect(stopped.session?.completedChunks).toBe(2);
    expect(stopped.progress.percent).toBe(50); // 10MiB committed of 20MiB
  });

  it("treats a raw AbortError as a pause, not a retryable failure", async () => {
    const q = makeQueue(1);
    let started = false;

    mocked.mockImplementation((_file, _onProgress, signal) => {
      started = true;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });

    const p = q.add(makeFile(100), "u-1/clip", "video");
    for (let i = 0; i < 50 && !started; i++) {
      await new Promise((r) => setTimeout(r, 0));
    }
    const id = q.getAll()[0].id;

    q.pauseUpload(id);
    const stopped = await p;
    // Must not fall into auto-retry ("retrying") or "error".
    expect(stopped.status).toBe("paused");
  });

  it("ignores pause on an already-stopped item", async () => {
    const q = makeQueue(0);
    const p = q.add(makeFile(), "u-1/clip", "video");
    const id = q.getAll()[0].id;
    q.pauseUpload(id);
    await p;
    expect(q.pauseUpload(id)).toBe(false);
  });
});
