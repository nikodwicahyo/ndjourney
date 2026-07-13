import { UploadConfig, getChunkSize, calculateTotalChunks } from "./upload-config";

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

interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  resource_type: string;
}

function buildTransformedDeliveryUrl(
  secureUrl: string,
  transformation: string,
  format?: string
): string {
  const [baseUrl, query = ""] = secureUrl.split("?");
  const transformedUrl = baseUrl.replace("/upload/", `/upload/${transformation}/`);
  const withFormat = format ? transformedUrl.replace(/\.[^/.]+$/, `.${format}`) : transformedUrl;
  return query ? `${withFormat}?${query}` : withFormat;
}

function getThumbnailUrl(result: CloudinaryUploadResponse): string {
  const transform = "w_400,h_400,c_fill,q_auto";
  if (result.resource_type === "video") {
    return buildTransformedDeliveryUrl(result.secure_url, `${transform},f_jpg`, "jpg");
  }

  if (result.resource_type === "image") {
    return buildTransformedDeliveryUrl(result.secure_url, `${transform},f_auto`);
  }

  return result.secure_url;
}

interface SignedUploadParams {
  uploadUrl: string;
  uploadParams: Record<string, string>;
  chunkSize: number;
  totalChunks: number;
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
  chunkSize?: number
): Promise<SignedUploadParams> {
  const response = await fetch("/api/upload/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName, fileType, fileSize, folder, chunkSize }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to get signed upload params" }));
    throw new Error(error.error || "Failed to get signed upload params");
  }

  const data = await response.json();
  return {
    uploadUrl: data.uploadUrl,
    uploadParams: data.uploadParams,
    chunkSize: data.chunkSize,
    totalChunks: data.totalChunks,
  };
}

async function uploadToServer(file: File, folder: string, signal?: AbortSignal): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000);

  if (signal) {
    signal.addEventListener("abort", () => controller.abort());
  }

  try {
    const response = await fetch("/api/upload/server", {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server upload failed: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
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

async function uploadChunk(
  uploadUrl: string,
  uploadParams: Record<string, string>,
  chunk: Blob,
  start: number,
  end: number,
  totalSize: number,
  uniqueUploadId: string,
  signal?: AbortSignal
): Promise<Response> {
  const formData = new FormData();
  
  // Send signed params + signature + api_key + cloud_name
  Object.entries(uploadParams).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      formData.append(key, value);
    }
  });
  
  formData.append("file", chunk);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 mins timeout per chunk

  if (signal) {
    signal.addEventListener("abort", () => controller.abort());
  }

  try {
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Range": `bytes ${start}-${end}/${totalSize}`,
        "X-Unique-Upload-Id": uniqueUploadId,
      },
      body: formData,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof DOMException && error.name === "AbortError") {
      if (signal?.aborted) {
        throw createUploadError("Upload aborted", { isAborted: true, cause: error, uploadUrl });
      }
      throw createUploadError("Upload timeout", { isTimeout: true, cause: error, uploadUrl });
    }

    if (isCorsError(error)) {
      const corsError = error as TypeError;
      const corsMessage = 
        "CORS Error: Browser blocked upload to Cloudinary. " +
        "Fix: Add your domain to Cloudinary CORS settings (Cloudinary Dashboard > Settings > Security > CORS). " +
        `Upload URL: ${uploadUrl}`;
      throw createUploadError(corsMessage, { isCorsError: true, isNetworkError: true, cause: corsError, uploadUrl });
    }

    throw createUploadError(
      `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      { isNetworkError: true, cause: error instanceof Error ? error : undefined, uploadUrl }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function uploadFileChunked(
  file: File,
  onProgress: (progress: ChunkUploadProgress) => void,
  signal?: AbortSignal,
  config?: Partial<UploadConfig>
): Promise<UploadResult> {
  const cfg = { ...UploadConfig, ...config };
  const fileName = file.name;
  const fileSize = file.size;
  const fileType = file.type;
  const chunkSize = getChunkSize(fileSize);
  const totalChunks = calculateTotalChunks(fileSize);

  let uploadedBytes = 0;
  let completedChunks = 0;
  let startTime = Date.now();
  let lastProgressTime = startTime;
  let lastUploadedBytes = 0;
  let usedFallback = false;

  const uniqueUploadId = `uq-${Date.now()}-${Math.random().toString(36).substring(2, 12)}`;

  const updateProgress = (status: ChunkUploadProgress["status"], error?: string) => {
    const now = Date.now();
    const timeElapsed = (now - startTime) / 1000;
    const speed = timeElapsed > 0 ? uploadedBytes / timeElapsed : 0;
    const remainingBytes = fileSize - uploadedBytes;
    const eta = speed > 0 ? remainingBytes / speed : 0;

    onProgress({
      fileName,
      fileSize,
      loaded: uploadedBytes,
      total: fileSize,
      uploadedBytes,
      totalChunks,
      completedChunks,
      currentChunk: completedChunks + 1,
      progress: (uploadedBytes / fileSize) * 100,
      speed,
      eta,
      status,
      error,
    });
  };

  updateProgress("uploading");

  try {
    const { uploadUrl, uploadParams, chunkSize: signedChunkSize, totalChunks: signedTotalChunks } = await getSignedUploadParams(
      fileName,
      fileType,
      fileSize,
      "ndjourney-web",
      chunkSize
    );

    const actualChunkSize = signedChunkSize;
    const actualTotalChunks = signedTotalChunks;

    let lastResponse: Response | null = null;

    for (let chunkIndex = 0; chunkIndex < actualTotalChunks; chunkIndex++) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const start = chunkIndex * actualChunkSize;
      const end = Math.min(start + actualChunkSize, fileSize);
      const chunk = file.slice(start, end);

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
            start,
            end - 1,
            fileSize,
            uniqueUploadId,
            signal
          );

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Chunk ${chunkIndex + 1} failed: ${response.status} ${errorText}`);
          }

          lastResponse = response;
          success = true;
        } catch (err) {
          retries++;
          if (retries > cfg.MAX_RETRIES) {
            throw err;
          }
        }
      }

      uploadedBytes += chunk.size;
      completedChunks++;

      const now = Date.now();
      if (now - lastProgressTime >= cfg.PROGRESS_THROTTLE_MS) {
        updateProgress("uploading");
        lastProgressTime = now;
        lastUploadedBytes = uploadedBytes;
      }
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
    
    if ((uploadError.isCorsError || uploadError.isNetworkError || !usedFallback) && !usedFallback && fileSize <= 100 * 1024 * 1024) {
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 mins timeout

  if (signal) {
    signal.addEventListener("abort", () => controller.abort());
  }

  try {
    const response = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof DOMException && error.name === "AbortError") {
      if (signal?.aborted) {
        throw createUploadError("Upload aborted", { isAborted: true, cause: error, uploadUrl });
      }
      throw createUploadError("Upload timeout", { isTimeout: true, cause: error, uploadUrl });
    }
    if (isCorsError(error)) {
      throw createUploadError("CORS Error", { isCorsError: true, isNetworkError: true, cause: error as Error, uploadUrl });
    }
    throw createUploadError(
      `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      { isNetworkError: true, cause: error instanceof Error ? error : undefined, uploadUrl }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function uploadFileSimple(
  file: File,
  onProgress: (progress: ChunkUploadProgress) => void,
  signal?: AbortSignal,
  config?: Partial<UploadConfig>
): Promise<UploadResult> {
  const cfg = { ...UploadConfig, ...config };
  const fileName = file.name;
  const fileSize = file.size;
  const fileType = file.type;

  // Use simple direct upload for files <= 10MB
  const THRESHOLD = 10 * 1024 * 1024; // 10MB
  if (fileSize <= THRESHOLD) {
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

      const response = await uploadSimple(uploadUrl, uploadParams, file, signal);
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
  
  return uploadFileChunked(file, onProgress, signal, config);
}
