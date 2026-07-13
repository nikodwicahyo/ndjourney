import { formatBytes } from "./upload-config";

export type UploadResourceType = "image" | "video" | "raw";

type UploadPolicy = {
  maxBytes: number;
  resourceType: UploadResourceType;
};

const MB = 1024 * 1024;
const MAX_IMAGE_BYTES = 25 * MB;
const MAX_VIDEO_BYTES = 500 * MB;

const BLOCKED_EXTENSIONS = new Set([
  "apk",
  "app",
  "bat",
  "bin",
  "cmd",
  "com",
  "cpl",
  "dll",
  "dmg",
  "exe",
  "hta",
  "iso",
  "jar",
  "js",
  "jse",
  "msi",
  "ps1",
  "scr",
  "sh",
  "vbs",
  "wsf",
  "zip",
  "rar",
  "7z",
  "tar",
  "gz",
]);

const DEFAULT_LIMITS = {
  image: MAX_IMAGE_BYTES,
  video: MAX_VIDEO_BYTES,
};

export const UPLOAD_FOLDER = "ndjourney-web";

function getExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase().trim() || "";
}

export function sanitizeFileName(fileName: string): string {
  return fileName
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/\.+/g, ".")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "upload";
}

export function validateUploadRequest(input: {
  fileName: string;
  fileType: string;
  fileSize: number;
}): { valid: true; policy: UploadPolicy } | { valid: false; error: string } {
  const fileSize = Number(input.fileSize);
  const fileType = input.fileType.trim().toLowerCase();
  const extension = getExtension(input.fileName);

  if (!input.fileName.trim()) return { valid: false, error: "File name is required" };
  if (!Number.isFinite(fileSize) || fileSize <= 0) return { valid: false, error: "File is empty or invalid" };
  if (!fileType) return { valid: false, error: "File type is required" };
  if (BLOCKED_EXTENSIONS.has(extension)) return { valid: false, error: "File type is not allowed" };

  if (fileType.startsWith("image/")) {
    if (fileSize > DEFAULT_LIMITS.image) {
      return { valid: false, error: `Image exceeds ${formatBytes(DEFAULT_LIMITS.image)} limit` };
    }
    return { valid: true, policy: { maxBytes: DEFAULT_LIMITS.image, resourceType: "image" } };
  }

  if (fileType.startsWith("video/")) {
    if (fileSize > DEFAULT_LIMITS.video) {
      return { valid: false, error: `Video exceeds ${formatBytes(DEFAULT_LIMITS.video)} limit` };
    }
    return { valid: true, policy: { maxBytes: DEFAULT_LIMITS.video, resourceType: "video" } };
  }

  if (fileType.startsWith("audio/")) {
    if (fileSize > DEFAULT_LIMITS.video) {
      return { valid: false, error: `Audio exceeds ${formatBytes(DEFAULT_LIMITS.video)} limit` };
    }
    return { valid: true, policy: { maxBytes: DEFAULT_LIMITS.video, resourceType: "raw" } };
  }

  return { valid: false, error: "Only image and video files are allowed in gallery" };
}

export function isAllowedCloudinaryUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" &&
      parsed.hostname === `res.cloudinary.com` &&
      parsed.pathname.startsWith(`/${process.env.CLOUDINARY_CLOUD_NAME}/`);
  } catch {
    return false;
  }
}

export function publicIdBelongsToUser(publicId: string, userId: string): boolean {
  const normalizedPublicId = publicId.replace(/^\/+/, "");
  const normalizedFolder = UPLOAD_FOLDER.replace(/^\/+|\/+$/g, "");

  return (
    !normalizedPublicId.includes("..") &&
    (normalizedPublicId.startsWith(`${userId}/`) ||
      normalizedPublicId.startsWith(`${normalizedFolder}/${userId}/`))
  );
}
