import { formatBytes } from "./upload-config";

export type UploadResourceType = "image" | "video" | "raw";

type UploadPolicy = {
  maxBytes: number;
  resourceType: UploadResourceType;
};

const MB = 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * MB;
const MAX_VIDEO_BYTES = 100 * MB;

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
  "svg",
  "html",
  "htm",
  "xhtml",
  "php",
  "swf",
]);

const DEFAULT_LIMITS = {
  image: MAX_IMAGE_BYTES,
  video: MAX_VIDEO_BYTES,
};

// active-content MIME must never reach storage — SVG/HTML render as
// script in the browser when served from Cloudinary (stored-XSS vector).
const BLOCKED_MIME = new Set([
  "image/svg+xml",
  "text/html",
  "application/xhtml+xml",
  "application/xml",
  "text/xml",
  "image/x-icon",
]);

export const UPLOAD_FOLDER = "ndjourney-web";

// Canonical delivery formats, aligned with the ALLOWED_TYPES MIME lists in
// app/api/upload/{route,bulk} and the magic-bytes table (lib/upload-magic).
// Cloudinary Admin API reports these identifiers — the same lists gate the
// signed `allowed_formats` param and the pre-save asset verification.
export const ALLOWED_IMAGE_FORMATS = ["jpg", "jpeg", "png", "webp", "heic", "heif"];
export const ALLOWED_VIDEO_FORMATS = ["mp4", "mov", "webm", "avi", "mkv", "ogv", "ogg", "mpg", "mpeg"];

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

  if (!input.fileName.trim()) return { valid: false, error: "Nama file wajib diisi" };
  if (!Number.isFinite(fileSize) || fileSize <= 0) return { valid: false, error: "File kosong atau tidak valid" };
  if (!fileType) return { valid: false, error: "Tipe file wajib diisi" };
  if (BLOCKED_MIME.has(fileType)) return { valid: false, error: "Tipe file tidak diizinkan" };
  if (BLOCKED_EXTENSIONS.has(extension)) return { valid: false, error: "Tipe file tidak diizinkan" };

  if (fileType.startsWith("image/")) {
    if (fileSize > DEFAULT_LIMITS.image) {
      return { valid: false, error: `Ukuran gambar melebihi batas ${formatBytes(DEFAULT_LIMITS.image)}` };
    }
    return { valid: true, policy: { maxBytes: DEFAULT_LIMITS.image, resourceType: "image" } };
  }

  if (fileType.startsWith("video/")) {
    if (fileSize > DEFAULT_LIMITS.video) {
      return { valid: false, error: `Ukuran video melebihi batas ${formatBytes(DEFAULT_LIMITS.video)}` };
    }
    return { valid: true, policy: { maxBytes: DEFAULT_LIMITS.video, resourceType: "video" } };
  }

  if (fileType.startsWith("audio/")) {
    if (fileSize > DEFAULT_LIMITS.video) {
      return { valid: false, error: `Ukuran audio melebihi batas ${formatBytes(DEFAULT_LIMITS.video)}` };
    }
    return { valid: true, policy: { maxBytes: DEFAULT_LIMITS.video, resourceType: "raw" } };
  }

  return { valid: false, error: "Hanya file gambar dan video yang diizinkan di galeri" };
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

// Delivery-path allowlist for persisted media. The signature on /api/upload/sign
// does not bind resource_type (it travels in the URL path), so a signed image
// upload can be replayed against /raw/upload — a raw delivery URL must never
// be saved as a gallery photo. Thumbnails built by lib/cloudinary-urls keep
// the same /image|video/upload/ base, so they pass unchanged.
export type MediaDeliveryKind = "image" | "video";

export function deliveryKind(url: string): MediaDeliveryKind | null {
  try {
    const path = new URL(url).pathname;
    if (path.includes("/image/upload/")) return "image";
    if (path.includes("/video/upload/")) return "video";
    return null;
  } catch {
    return null;
  }
}

export function isAllowedMediaDeliveryUrl(url: string): boolean {
  return isAllowedCloudinaryUrl(url) && deliveryKind(url) !== null;
}

export function maxBytesForKind(kind: MediaDeliveryKind): number {
  return kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
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
