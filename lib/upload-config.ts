export interface UploadConfig {
  CHUNK_SIZES: {
    small: number;
    medium: number;
    large: number;
    xlarge: number;
  };
  CHUNK_THRESHOLDS: {
    small: number;
    medium: number;
    large: number;
  };
  SINGLE_FILE_MAX_SIZE: number;
  MAX_RETRIES: number;
  RETRY_DELAY_MS: number;
  PROGRESS_THROTTLE_MS: number;
  DEFAULT_CONCURRENCY: number;
  MAX_IMAGE_SIZE: number;
  MAX_VIDEO_SIZE: number;
  MAX_RAW_SIZE: number;
  MAX_IMAGE_MEGAPIXELS: number;
  MAX_TOTAL_MEGAPIXELS: number;
}

export const UploadConfig: UploadConfig = {
  CHUNK_SIZES: {
    small: 2 * 1024 * 1024,
    medium: 5 * 1024 * 1024,
    large: 10 * 1024 * 1024,
    xlarge: 20 * 1024 * 1024,
  },
  CHUNK_THRESHOLDS: {
    small: 10 * 1024 * 1024,
    medium: 50 * 1024 * 1024,
    large: 100 * 1024 * 1024,
  },
  SINGLE_FILE_MAX_SIZE: 25 * 1024 * 1024,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  PROGRESS_THROTTLE_MS: 200,
  DEFAULT_CONCURRENCY: 3,
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  MAX_VIDEO_SIZE: 100 * 1024 * 1024,
  MAX_RAW_SIZE: 10 * 1024 * 1024,
  MAX_IMAGE_MEGAPIXELS: 25,
  MAX_TOTAL_MEGAPIXELS: 50,
};

export function getChunkSize(fileSize: number): number {
  const { CHUNK_SIZES, CHUNK_THRESHOLDS } = UploadConfig;
  
  if (fileSize <= CHUNK_THRESHOLDS.small) return CHUNK_SIZES.small;
  if (fileSize <= CHUNK_THRESHOLDS.medium) return CHUNK_SIZES.medium;
  if (fileSize <= CHUNK_THRESHOLDS.large) return CHUNK_SIZES.large;
  return CHUNK_SIZES.xlarge;
}

export function calculateTotalChunks(fileSize: number): number {
  return Math.ceil(fileSize / getChunkSize(fileSize));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function formatSpeed(bytesPerSecond: number): string {
  return formatBytes(bytesPerSecond) + "/s";
}

export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "--";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export function getResourceType(mimeType: string): "image" | "video" | "raw" | "auto" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "raw";
  return "auto";
}

export function generatePublicId(fileName: string, userId: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "bin";
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `${userId}/${timestamp}-${random}.${ext}`;
}

export function validateFileSize(file: File): { valid: boolean; error?: string } {
  const { MAX_IMAGE_SIZE, MAX_VIDEO_SIZE, MAX_RAW_SIZE } = UploadConfig;
  const size = file.size;
  const type = getResourceType(file.type);

  if (type === "image" && size > MAX_IMAGE_SIZE) {
    return { valid: false, error: `Image exceeds ${formatBytes(MAX_IMAGE_SIZE)} limit` };
  }
  if (type === "video" && size > MAX_VIDEO_SIZE) {
    return { valid: false, error: `Video exceeds ${formatBytes(MAX_VIDEO_SIZE)} limit` };
  }
  if (type === "auto" && size > MAX_RAW_SIZE) {
    return { valid: false, error: `File exceeds ${formatBytes(MAX_RAW_SIZE)} limit` };
  }
  return { valid: true };
}

export function validateImageDimensions(width: number, height: number): { valid: boolean; error?: string } {
  const { MAX_IMAGE_MEGAPIXELS, MAX_TOTAL_MEGAPIXELS } = UploadConfig;
  const megapixels = (width * height) / 1_000_000;

  if (megapixels > MAX_IMAGE_MEGAPIXELS) {
    return { valid: false, error: `Image exceeds ${MAX_IMAGE_MEGAPIXELS} MP limit (${megapixels.toFixed(1)} MP)` };
  }
  if (megapixels > MAX_TOTAL_MEGAPIXELS) {
    return { valid: false, error: `Image exceeds ${MAX_TOTAL_MEGAPIXELS} MP total frames limit` };
  }
  return { valid: true };
}

export function getMaxFileSize(mimeType: string): number {
  const { MAX_IMAGE_SIZE, MAX_VIDEO_SIZE, MAX_RAW_SIZE } = UploadConfig;
  const type = getResourceType(mimeType);
  if (type === "image") return MAX_IMAGE_SIZE;
  if (type === "video") return MAX_VIDEO_SIZE;
  return MAX_RAW_SIZE;
}