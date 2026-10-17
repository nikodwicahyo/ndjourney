import { UploadConfig, resolveUploadMime, SIMPLE_UPLOAD_MAX_BYTES } from "./upload-config";
import { getUploadThumbnailUrl } from "./cloudinary-urls";

export interface ChunkUploadProgress {
  fileName: string;
  fileSize: number;
  loaded: number;
  total: number;
  uploadedBytes: number;
  totalChunks: number;
  completedChunks: number;
  currentChunk: number;
  progress: number;
  speed: number;
  eta: number;
  status: "pending" | "uploading" | "complete" | "error" | "retrying" | "fallback";
  error?: string;
}

export interface UploadResult {
  url: string;
  publicId: string;
  secureUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  isVideo?: boolean;
  fileSize: number;
}

/**
 * Identifies a Cloudinary chunked-upload session so an interrupted upload can
 * resume instead of restarting. `uniqueUploadId` is the server-side session key
 * (`X-Unique-Upload-Id`); `publicId` is the asset path, reused when re-signing so
 * the resumed chunks land on the same asset. `completedChunks`/`uploadedBytes`
 * describe how far the last attempt got.
 */
export interface UploadSession {
  uniqueUploadId: string;
  publicId: string;
  completedChunks: number;
  uploadedBytes: number;
}

export interface UploadFileOptions {
  /** Resume a previous attempt for this file instead of starting from chunk 0. */
  resume?: UploadSession;
  /**
   * Called with the current session after signing and after each committed
   * chunk (so the caller can persist it across retries), or `null` when the
   * session must be discarded and the next attempt restarted from scratch.
   */
  onSession?: (session: UploadSession | null) => void;
  /**
   * Checked between chunks. When it returns true the upload stops at the last
   * *committed* chunk boundary — the in-flight chunk is allowed to finish and
   * commit first, so an orderly stop (pause) never loses transferred bytes.
   */
  shouldStop?: () => boolean;
}

/**
 * Pure resume math: which chunk to start at and how many bytes are already
 * committed. The final chunk is never skipped — its response carries the asset
 * metadata and marks the upload done server-side.
 */
export function resolveResumeStart(
  resume: UploadSession | undefined,
  chunkSize: number,
  totalChunks: number,
  fileSize: number,
): { startChunk: number; startBytes: number } {
  const requested = resume?.completedChunks ?? 0;
  const startChunk = Math.max(0, Math.min(requested, totalChunks - 1));
  return { startChunk, startBytes: Math.min(startChunk * chunkSize, fileSize) };
}

interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  resource_type: string;
}

/**
 * A "stall" timeout that does NOT count time while the tab is hidden.
 * Browsers throttle timers and may pause in-flight requests when a tab is
 * backgrounded or minimized, so aborting on a fixed timer there would kill an
 * otherwise-recoverable upload. While hidden we pause the clock; the request
 * is only aborted after STALL_TIMEOUT of *active* (visible) stalled time.
 */
const STALL_TIMEOUT = 120_000;

export function createStallTimeout(signal?: AbortSignal): {
  signal: AbortSignal;
  clear: () => void;
  onProgress: () => void;
  isAborted: () => boolean;
} {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let elapsedVisible = 0;
  let lastTick = Date.now();
  let aborted = false;
  let hidden = typeof document !== "undefined" && document.visibilityState === "hidden";

  const controller = new AbortController();
  if (signal) {
    signal.addEventListener("abort", () => controller.abort());
  }

  const arm = () => {
    if (timer || aborted || controller.signal.aborted) return;
    timer = setTimeout(() => {
      timer = null;
      elapsedVisible += Date.now() - lastTick;
      lastTick = Date.now();
      if (elapsedVisible >= STALL_TIMEOUT) {
        aborted = true;
        controller.abort();
      } else if (!hidden) {
        arm();
      }
    }, Math.min(STALL_TIMEOUT - elapsedVisible, 5000));
  };

  const onVisibility = () => {
    const now = Date.now();
    if (hidden && !document.hidden) {
      // became visible again: resume counting
    } else if (!hidden && document.hidden) {
      // became hidden: stop counting, keep whatever timer was pending
      if (timer) {
        clearTimeout(timer);
        timer = null;
        elapsedVisible += now - lastTick;
      }
    }
    hidden = document.hidden;
    lastTick = now;
    if (!hidden && !aborted && !controller.signal.aborted) arm();
  };

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
    if (!hidden) arm();
  }

  return {
    signal: controller.signal,
    clear: () => {
      if (timer) clearTimeout(timer);
      timer = null;
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    },
    onProgress: () => {
      const now = Date.now();
      if (!hidden) elapsedVisible = 0;
      lastTick = now;
      if (!hidden && !aborted && !controller.signal.aborted) arm();
    },
    isAborted: () => aborted || controller.signal.aborted,
  };
}

function getThumbnailUrl(result: CloudinaryUploadResponse): string {
  return getUploadThumbnailUrl(result.secure_url, result.resource_type);
}

interface SignedUploadParams {
  uploadUrl: string;
  uploadParams: Record<string, string>;
  chunkSize: number;
  totalChunks: number;
  publicId: string;
}

interface UploadError extends Error {
  code?: string;
  status?: number;
  isCorsError?: boolean;
  isNetworkError?: boolean;
  isTimeout?: boolean;
  isAborted?: boolean;
  uploadUrl?: string;
}

function createUploadError(message: string, options: {
  code?: string;
  status?: number;
  isCorsError?: boolean;
  isNetworkError?: boolean;
  isTimeout?: boolean;
  isAborted?: boolean;
  cause?: Error;
  uploadUrl?: string;
} = {}): UploadError {
  const error = new Error(message) as UploadError;
  error.code = options.code;
  error.status = options.status;
  error.isCorsError = options.isCorsError;
  error.isNetworkError = options.isNetworkError;
  error.isTimeout = options.isTimeout;
  error.isAborted = options.isAborted;
  error.uploadUrl = options.uploadUrl;
  if (options.cause) {
    error.cause = options.cause;
  }
  return error;
}

export async function getSignedUploadParams(
  fileName: string,
  fileType: string,
  fileSize: number,
  folder = "ndjourney-web",
  chunkSize?: number,
  publicId?: string
): Promise<SignedUploadParams> {
  const response = await fetch("/api/upload/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName, fileType, fileSize, folder, chunkSize, publicId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Gagal mendapatkan parameter upload bertanda tangan" }));
    throw new Error(error.error || "Gagal mendapatkan parameter upload bertanda tangan");
  }

  const data = await response.json();
  return {
    uploadUrl: data.uploadUrl,
    uploadParams: data.uploadParams,
    chunkSize: data.chunkSize,
    totalChunks: data.totalChunks,
    publicId: data.publicId,
  };
}

async function uploadToServer(file: File, folder: string, signal?: AbortSignal): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);

  const stall = createStallTimeout(signal);

  try {
    const response = await fetch("/api/upload/server", {
      method: "POST",
      body: formData,
      signal: stall.signal,
    });
    stall.clear();

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server upload failed: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    stall.clear();
    if (error instanceof DOMException && error.name === "AbortError") {
      if (signal?.aborted) {
        throw createUploadError("Server upload aborted", { isAborted: true, cause: error });
      }
      throw createUploadError("Server upload timeout", { isTimeout: true, cause: error });
    }
    throw createUploadError(
      `Server upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      { isNetworkError: true, cause: error instanceof Error ? error : undefined }
    );
  }
}

function isCorsError(error: unknown): boolean {
  return error instanceof TypeError && error.message === "Failed to fetch";
}

/**
 * Uploads one chunk via XHR so `xhr.upload.onprogress` reports byte-level
 * progress *within* the chunk. `fetch` (the previous implementation) exposes no
 * upload-progress events, which is why the bar only jumped once per chunk.
 * `onChunkProgress` receives bytes transferred for this chunk (0..chunk.size).
 */
function uploadChunk(
  uploadUrl: string,
  uploadParams: Record<string, string>,
  chunk: Blob,
  start: number,
  end: number,
  totalSize: number,
  uniqueUploadId: string,
  onChunkProgress: (loadedInChunk: number) => void,
  signal?: AbortSignal
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();

    // Send signed params + signature + api_key + cloud_name (no manual
    // Content-Type — the browser sets the multipart boundary).
    Object.entries(uploadParams).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        formData.append(key, value);
      }
    });

    formData.append("file", chunk);

    const xhr = new XMLHttpRequest();
    const stall = createStallTimeout(signal);

    const onAbort = () => xhr.abort();

    const cleanup = () => {
      stall.clear();
      xhr.upload.onprogress = null;
      xhr.onload = null;
      xhr.onerror = null;
      xhr.onabort = null;
      signal?.removeEventListener("abort", onAbort);
    };

    if (signal) {
      signal.addEventListener("abort", onAbort);
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        // multipart overhead can push e.loaded past the chunk — clamp so the
        // caller's running total never exceeds fileSize.
        onChunkProgress(Math.max(0, Math.min(e.loaded, chunk.size)));
      }
      stall.onProgress();
    };

    xhr.onload = () => {
      const responseType = xhr.getResponseHeader("Content-Type") ?? "application/json";
      cleanup();
      resolve(
        new Response(xhr.responseText, {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: { "Content-Type": responseType },
        })
      );
    };

    xhr.onerror = () => {
      cleanup();
      reject(
        createUploadError("Upload failed: network error", {
          isNetworkError: true,
          uploadUrl,
        })
      );
    };

    xhr.onabort = () => {
      cleanup();
      if (signal?.aborted) {
        reject(createUploadError("Upload aborted", { isAborted: true, uploadUrl }));
      } else {
        // Stalled (timeout) or backgrounded: treat as retryable network error.
        reject(createUploadError("Upload timeout", { isTimeout: true, isNetworkError: true, uploadUrl }));
      }
    };

    try {
      xhr.open("POST", uploadUrl);
      xhr.setRequestHeader("Content-Range", `bytes ${start}-${end}/${totalSize}`);
      xhr.setRequestHeader("X-Unique-Upload-Id", uniqueUploadId);
      xhr.send(formData);
    } catch (error) {
      cleanup();
      reject(
        createUploadError("Upload failed: network error", {
          isNetworkError: true,
          cause: error instanceof Error ? error : undefined,
          uploadUrl,
        })
      );
    }
  });
}

export async function uploadFileChunked(
  file: File,
  onProgress: (progress: ChunkUploadProgress) => void,
  signal?: AbortSignal,
  config?: Partial<UploadConfig>,
  options?: UploadFileOptions
): Promise<UploadResult> {
  const cfg = { ...UploadConfig, ...config };
  const fileName = file.name;
  const fileSize = file.size;
  // Canonical MIME (extension fallback) — File.type is read-only and empty
  // for formats browsers don't recognize (.heic), which previously failed
  // server validation. Bytes are still verified server-side.
  const fileType = resolveUploadMime(file.name, file.type);
  const { CHUNK_SIZES, CHUNK_THRESHOLDS } = cfg;
  const chunkSize =
    fileSize <= CHUNK_THRESHOLDS.small ? CHUNK_SIZES.small :
    fileSize <= CHUNK_THRESHOLDS.medium ? CHUNK_SIZES.medium :
    fileSize <= CHUNK_THRESHOLDS.large ? CHUNK_SIZES.large :
    CHUNK_SIZES.xlarge;
  let totalChunks = Math.ceil(fileSize / chunkSize);

  // Resume: reuse the previous session's unique id + public id so Cloudinary
  // continues the same upload instead of starting a new asset.
  const resume = options?.resume;
  const uniqueUploadId =
    resume?.uniqueUploadId ?? `uq-${Date.now()}-${Math.random().toString(36).substring(2, 12)}`;

  let uploadedBytes = resume?.uploadedBytes ?? 0;
  let completedChunks = resume?.completedChunks ?? 0;
  let speedBaseBytes = uploadedBytes;
  const startTime = Date.now();
  let lastProgressTime = startTime;
  let startChunk = 0;
  let usedFallback = false;

  const updateProgress = (
    status: ChunkUploadProgress["status"],
    error?: string,
    inFlightBytes = 0
  ) => {
    const now = Date.now();
    const committed = uploadedBytes;
    const loaded = Math.min(committed + inFlightBytes, fileSize);
    const timeElapsed = Math.max((now - startTime) / 1000, 0.001);
    // speed/eta measure only bytes moved in *this* attempt, so a resumed
    // upload doesn't report an inflated rate for chunks it never re-sent.
    const transferred = Math.max(loaded - speedBaseBytes, 0);
    const speed = transferred / timeElapsed;
    const eta = speed > 0 ? (fileSize - loaded) / speed : 0;

    onProgress({
      fileName,
      fileSize,
      loaded,
      total: fileSize,
      uploadedBytes: committed,
      totalChunks,
      completedChunks,
      currentChunk: completedChunks + 1,
      progress: (loaded / fileSize) * 100,
      speed,
      eta,
      status,
      error,
    });
  };

  updateProgress("uploading");

  try {
    const {
      uploadUrl,
      uploadParams,
      chunkSize: signedChunkSize,
      totalChunks: signedTotalChunks,
      publicId: signedPublicId,
    } = await getSignedUploadParams(
      fileName,
      fileType,
      fileSize,
      "ndjourney-web",
      chunkSize,
      resume?.publicId
    );

    const actualChunkSize = signedChunkSize;
    const actualTotalChunks = signedTotalChunks;
    totalChunks = actualTotalChunks;

    // Skip already-committed chunks (never the final one — see helper).
    const start = resolveResumeStart(resume, actualChunkSize, actualTotalChunks, fileSize);
    startChunk = start.startChunk;
    completedChunks = startChunk;
    uploadedBytes = start.startBytes;
    speedBaseBytes = uploadedBytes;

    // Persist the session up front (public id is now known) so even a failure
    // before the first chunk can be resumed on the next attempt.
    options?.onSession?.({
      uniqueUploadId,
      publicId: signedPublicId,
      completedChunks,
      uploadedBytes,
    });

    let lastResponse: Response | null = null;

    for (let chunkIndex = startChunk; chunkIndex < actualTotalChunks; chunkIndex++) {
      if (signal?.aborted) {
        throw createUploadError("Upload aborted", { isAborted: true });
      }
      // Reached only after the previous chunk committed, so an orderly stop
      // (pause) here loses nothing. Flagged as an abort so the caller skips the
      // server fallback and the queue can tell "paused" from "failed".
      if (options?.shouldStop?.()) {
        throw createUploadError("Upload paused", { isAborted: true });
      }

      const chunkStart = chunkIndex * actualChunkSize;
      const chunkEnd = Math.min(chunkStart + actualChunkSize, fileSize);
      const chunk = file.slice(chunkStart, chunkEnd);

      let retries = 0;
      let success = false;

      while (retries <= cfg.MAX_RETRIES && !success) {
        try {
          if (retries > 0) {
            updateProgress("retrying");
            const delay = cfg.RETRY_DELAY_MS * Math.pow(2, retries - 1);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }

          const response = await uploadChunk(
            uploadUrl,
            uploadParams,
            chunk,
            chunkStart,
            chunkEnd - 1,
            fileSize,
            uniqueUploadId,
            (inFlight) => {
              const now = Date.now();
              if (now - lastProgressTime >= cfg.PROGRESS_THROTTLE_MS) {
                updateProgress("uploading", undefined, inFlight);
                lastProgressTime = now;
              }
            },
            signal
          );

          if (!response.ok) {
            const errorText = await response.text();
            throw createUploadError(
              `Chunk ${chunkIndex + 1} failed: ${response.status} ${errorText}`,
              { status: response.status, uploadUrl }
            );
          }

          lastResponse = response;
          success = true;
        } catch (err) {
          // Respect a user abort/cancel immediately — don't spend the retry
          // budget re-sending a chunk the caller asked us to stop.
          if (signal?.aborted) {
            throw err;
          }
          retries++;
          if (retries > cfg.MAX_RETRIES) {
            throw err;
          }
        }
      }

      uploadedBytes += chunk.size;
      completedChunks++;
      options?.onSession?.({
        uniqueUploadId,
        publicId: signedPublicId,
        completedChunks,
        uploadedBytes,
      });
      updateProgress("uploading");
      lastProgressTime = Date.now();
    }

    if (!lastResponse) {
      throw new Error("No response from chunk upload");
    }

    const result: CloudinaryUploadResponse = await lastResponse.json();

    const thumbnailUrl = getThumbnailUrl(result);

    updateProgress("complete");

    return {
      url: result.secure_url,
      publicId: result.public_id,
      secureUrl: result.secure_url,
      thumbnailUrl,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
      isVideo: result.resource_type === "video",
      fileSize,
    };
  } catch (error) {
    const uploadError = error as UploadError;

    // User abort (cancel/pause): never fall back to a server re-upload, never
    // mark the item failed — propagate so the queue finalises cancel/pause.
    if (uploadError.isAborted || signal?.aborted) {
      throw error;
    }

    // A chunk the server definitively rejected (bad range / expired session /
    // bad signature) means this session is unusable — drop it so the next
    // attempt starts clean instead of resuming into the same error forever.
    // 408/429 and 5xx are transient, so keep the session and let retries resume.
    if (
      startChunk > 0 &&
      uploadError.status != null &&
      uploadError.status >= 400 &&
      uploadError.status < 500 &&
      uploadError.status !== 408 &&
      uploadError.status !== 429
    ) {
      options?.onSession?.(null);
    }

    if (
      (uploadError.isCorsError || uploadError.isNetworkError || uploadError.isTimeout) &&
      !usedFallback &&
      // Only fall back to the server-side re-upload when nothing has been
      // committed yet (e.g. Cloudinary blocked before chunk 0). Once chunks
      // have landed, a network drop is better served by retrying with resume
      // than by re-uploading the whole file through the server.
      completedChunks === 0 &&
      fileSize <= 100 * 1024 * 1024
    ) {
      usedFallback = true;
      updateProgress("fallback", "Direct upload failed. Using server-side fallback...");

      try {
        const result = await uploadToServer(file, "ndjourney-web", signal);
        updateProgress("complete");
        return result;
      } catch (fallbackError) {
        throw fallbackError;
      }
    }

    updateProgress("error", error instanceof Error ? error.message : "Upload failed");
    throw error;
  }
}

async function uploadSimple(
  uploadUrl: string,
  uploadParams: Record<string, string>,
  file: File,
  signal?: AbortSignal
): Promise<Response> {
  const formData = new FormData();
  
  Object.entries(uploadParams).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      formData.append(key, value);
    }
  });
  
  formData.append("file", file);

  const stall = createStallTimeout(signal);

  try {
    const response = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
      signal: stall.signal,
    });
    stall.clear();
    return response;
  } catch (error) {
    stall.clear();
    if (error instanceof DOMException && error.name === "AbortError") {
      if (signal?.aborted) {
        throw createUploadError("Upload aborted", { isAborted: true, cause: error, uploadUrl });
      }
      throw createUploadError("Upload timeout", { isTimeout: true, isNetworkError: true, cause: error, uploadUrl });
    }
    if (isCorsError(error)) {
      throw createUploadError("CORS Error", { isCorsError: true, isNetworkError: true, cause: error as Error, uploadUrl });
    }
    throw createUploadError(
      `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      { isNetworkError: true, cause: error instanceof Error ? error : undefined, uploadUrl }
    );
  } finally {
    stall.clear();
  }
}

async function uploadSimpleWithXHR(
  uploadUrl: string,
  uploadParams: Record<string, string>,
  file: File,
  onProgress: (loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    Object.entries(uploadParams).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        formData.append(key, value);
      }
    });
    formData.append("file", file);

    const xhr = new XMLHttpRequest();

    const cleanup = () => {
      stall.clear();
      xhr.onload = null;
      xhr.onerror = null;
      xhr.onabort = null;
      xhr.upload.onprogress = null;
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
    };

    const onAbort = () => {
      xhr.abort();
    };
    if (signal) {
      signal.addEventListener("abort", onAbort);
    }

    const stall = createStallTimeout(signal);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(e.loaded, e.total);
      }
      stall.onProgress();
    };

    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(new Response(xhr.responseText, {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: { "Content-Type": "application/json" },
        }));
      } else {
        reject(createUploadError(
          `Upload failed: ${xhr.status} ${xhr.statusText}`,
          { status: xhr.status, uploadUrl }
        ));
      }
    };

    xhr.onerror = () => {
      cleanup();
      reject(createUploadError("CORS Error", { isCorsError: true, isNetworkError: true, uploadUrl }));
    };

    xhr.onabort = () => {
      cleanup();
      if (signal?.aborted) {
        reject(createUploadError("Upload aborted", { isAborted: true, uploadUrl }));
      } else {
        reject(createUploadError("Upload timeout", { isTimeout: true, isNetworkError: true, uploadUrl }));
      }
    };

    xhr.open("POST", uploadUrl);
    xhr.send(formData);
  });
}

export async function uploadFileSimple(
  file: File,
  onProgress: (progress: ChunkUploadProgress) => void,
  signal?: AbortSignal,
  config?: Partial<UploadConfig>,
  options?: UploadFileOptions
): Promise<UploadResult> {
  const cfg = { ...UploadConfig, ...config };
  const fileName = file.name;
  const fileSize = file.size;
  // Same canonical-MIME fallback as uploadFileChunked above.
  const fileType = resolveUploadMime(file.name, file.type);

  // Use simple direct upload for files <= 10MB (no chunk boundary to resume at)
  if (fileSize <= SIMPLE_UPLOAD_MAX_BYTES) {
    onProgress({
      fileName,
      fileSize,
      loaded: 0,
      total: fileSize,
      uploadedBytes: 0,
      totalChunks: 1,
      completedChunks: 0,
      currentChunk: 1,
      progress: 0,
      speed: 0,
      eta: 0,
      status: "uploading",
    });

    let usedFallback = false;

    try {
      const { uploadUrl, uploadParams } = await getSignedUploadParams(
        fileName,
        fileType,
        fileSize,
        "ndjourney-web"
      );

      const response = await uploadSimpleWithXHR(
        uploadUrl,
        uploadParams,
        file,
        (loaded, total) => {
          const speed = 0;
          const elapsed = 0;
          const timedProgress = {
            fileName,
            fileSize,
            loaded,
            total,
            uploadedBytes: loaded,
            totalChunks: 1,
            completedChunks: 0,
            currentChunk: 1,
            progress: total > 0 ? Math.round((loaded / total) * 100) : 0,
            speed,
            eta: 0,
            status: "uploading" as const,
          };
          onProgress(timedProgress);
        },
        signal
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} ${errorText}`);
      }

      const result: CloudinaryUploadResponse = await response.json();
      const thumbnailUrl = getThumbnailUrl(result);

      onProgress({
        fileName,
        fileSize,
        loaded: fileSize,
        total: fileSize,
        uploadedBytes: fileSize,
        totalChunks: 1,
        completedChunks: 1,
        currentChunk: 1,
        progress: 100,
        speed: 0,
        eta: 0,
        status: "complete",
      });

      return {
        url: result.secure_url,
        publicId: result.public_id,
        secureUrl: result.secure_url,
        thumbnailUrl,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        isVideo: result.resource_type === "video",
        fileSize,
      };
    } catch (error) {
      // User abort (cancel/pause) must stop the upload, not re-route the whole
      // file through the server-side fallback.
      if (signal?.aborted) throw error;
      if (!usedFallback && fileSize <= 100 * 1024 * 1024) {
        usedFallback = true;
        try {
          const result = await uploadToServer(file, "ndjourney-web", signal);
          onProgress({
            fileName,
            fileSize,
            loaded: fileSize,
            total: fileSize,
            uploadedBytes: fileSize,
            totalChunks: 1,
            completedChunks: 1,
            currentChunk: 1,
            progress: 100,
            speed: 0,
            eta: 0,
            status: "complete",
          });
          return result;
        } catch (fallbackError) {
          throw fallbackError;
        }
      }
      throw error;
    }
  }
  
  return uploadFileChunked(file, onProgress, signal, config, options);
}
