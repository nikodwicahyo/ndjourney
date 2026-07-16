import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export { cloudinary };

export type CloudinaryUploadResult = {
  url: string;
  publicId: string;
  secureUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  isVideo?: boolean;
};

export type ImageTransformOptions = {
  width?: number;
  height?: number;
  crop?: string;
  quality?: string | number;
  format?: string;
  blur?: number;
  gravity?: string;
};

const BASE_TRANSFORM: ImageTransformOptions = {
  quality: "auto",
  format: "auto",
};

export const BREAKPOINTS = [320, 480, 640, 768, 1024, 1280, 1536] as const;

function buildTransform(opts: ImageTransformOptions): string {
  const parts: string[] = [];
  if (opts.width) parts.push(`w_${opts.width}`);
  if (opts.height) parts.push(`h_${opts.height}`);
  if (opts.crop) parts.push(`c_${opts.crop}`);
  if (opts.quality) parts.push(`q_${opts.quality}`);
  if (opts.format) parts.push(`f_${opts.format}`);
  if (opts.blur) parts.push(`e_blur:${opts.blur}`);
  if (opts.gravity) parts.push(`g_${opts.gravity}`);
  return parts.join(",");
}

export function getOptimizedUrl(
  publicId: string,
  width = 800,
  options: ImageTransformOptions = {},
): string {
  const opts = { ...BASE_TRANSFORM, width, crop: "limit", ...options };
  return cloudinary.url(publicId, {
    transformation: [{ ...opts }],
    secure: true,
  });
}

export function getResponsiveUrls(
  publicId: string,
  options: ImageTransformOptions = {},
): { width: number; url: string }[] {
  return BREAKPOINTS.map((w) => ({
    width: w,
    url: getOptimizedUrl(publicId, w, options),
  }));
}

export function getSrcSet(
  publicId: string,
  options: ImageTransformOptions = {},
): string {
  return getResponsiveUrls(publicId, options)
    .map(({ width, url }) => `${url} ${width}w`)
    .join(", ");
}

export function getBlurUrl(publicId: string, size = 20): string {
  return cloudinary.url(publicId, {
    transformation: [
      { width: size, height: size, crop: "fill", quality: 1, blur: 1000 },
    ],
    secure: true,
  });
}

export function getNextImageUrl(
  publicId: string,
  width: number,
  options: ImageTransformOptions = {},
): string {
  const opts = { ...BASE_TRANSFORM, width, crop: "limit", ...options };
  const params = buildTransform(opts);
  return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${params}/${publicId}`;
}

const VIDEO_FORMATS = new Set(["mp4", "webm", "mov", "ogg", "avi", "mkv", "mpeg"]);

function isVideoFormat(format: string): boolean {
  return VIDEO_FORMATS.has(format.toLowerCase());
}

function getThumbnailUrl(publicId: string, format: string): string {
  const resourceType = isVideoFormat(format) ? "video" : "image";
    let url = cloudinary.url(publicId, {
      resource_type: resourceType,
      transformation: [
        { width: 400, height: 400, crop: "fill", quality: "auto", fetch_format: "jpg" }, // Force JPG for thumbnails
      ],
      secure: true,
    });
    if (isVideoFormat(format)) {
      url += ".jpg"; // Keep this, as Cloudinary might not add it for videos even with fetch_format: jpg
    }
    return url;
}

const UPLOAD_TRANSFORMS = [
  { quality: "auto:good", fetch_format: "auto", flags: "lossy" },
];

const VIDEO_UPLOAD_TRANSFORMS = [
  { quality: "auto:good", fetch_format: "auto" },
];

export async function uploadToCloudinary(
  file: string,
  folder = "ndjourney-web",
): Promise<CloudinaryUploadResult> {
  const result = await cloudinary.uploader.upload(file, {
    folder,
    resource_type: "auto",
    transformation: UPLOAD_TRANSFORMS,
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    secureUrl: result.secure_url,
    thumbnailUrl: getThumbnailUrl(result.public_id, result.format),
    width: result.width,
    height: result.height,
    format: result.format,
    bytes: result.bytes,
  };
}

export async function uploadStreamToCloudinary(
  fileStream: Readable,
  folder = "ndjourney-web",
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto",
        transformation: UPLOAD_TRANSFORMS,
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error("Upload failed"));
          return;
        }
        resolve(formatCloudinaryResult(result));
      },
    );
    fileStream.pipe(uploadStream);
  });
}

export async function uploadBufferToCloudinary(
  buffer: Buffer,
  folder = "ndjourney-web",
  isVideo = false
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const timeout = isVideo ? 300000 : 120000; // 5 min for video, 2 min for images
    const timeoutId = setTimeout(() => {
      reject(new Error(`Upload timeout after ${timeout / 1000}s`));
    }, timeout);

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: isVideo ? "video" : "auto",
        transformation: isVideo ? VIDEO_UPLOAD_TRANSFORMS : UPLOAD_TRANSFORMS,
      },
      (error, result) => {
        clearTimeout(timeoutId);
        if (error || !result) {
          reject(error || new Error("Upload failed"));
          return;
        }
        resolve(formatCloudinaryResult(result));
      },
    );
    uploadStream.end(buffer);
  });
}

function formatCloudinaryResult(result: {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}): CloudinaryUploadResult {
  return {
    url: result.secure_url,
    publicId: result.public_id,
    secureUrl: result.secure_url,
    thumbnailUrl: getThumbnailUrl(result.public_id, result.format),
    width: result.width,
    height: result.height,
    format: result.format,
    bytes: result.bytes,
  };
}

export async function deleteFromCloudinary(
  publicId: string,
  resourceType = "image",
): Promise<void> {
  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    invalidate: true,
  });

  if (result.result !== "ok") {
    throw new Error(
      `Cloudinary did not delete media ${publicId}: ${result.result ?? "unknown result"}`,
    );
  }
}

export type CloudinaryUsage = {
  storageUsed: number;
  storageLimit: number;
  creditsUsed: number;
  creditsLimit: number;
  resourcesCount: number;
  imagesBytes?: number;
  videosBytes?: number;
  rawBytes?: number;
  imagesCount?: number;
  videosCount?: number;
  rawCount?: number;
};

const FALLBACK_STORAGE_LIMIT =
  process.env.CLOUDINARY_STORAGE_LIMIT_BYTES
    ? Number(process.env.CLOUDINARY_STORAGE_LIMIT_BYTES)
    : 25 * 1024 * 1024 * 1024;

async function sumResourcesByType(type: string): Promise<{ count: number; bytes: number }> {
  let count = 0;
  let bytes = 0;
  let cursor: string | undefined;
  let pages = 0;
  try {
    do {
      const result: any = await cloudinary.api.resources({
        resource_type: type,
        max_results: 500,
        fields: "bytes",
        next_cursor: cursor,
      } as any);
      const resources: any[] = result.resources ?? [];
      for (const r of resources) {
        count++;
        bytes += r.bytes ?? 0;
      }
      cursor = result.next_cursor;
      pages++;
    } while (cursor && pages < 50);
  } catch {
    // A failing resource type should not break the whole calculation.
  }
  return { count, bytes };
}

export async function getCloudinaryUsage(): Promise<CloudinaryUsage> {
  try {
    const usage: any = await cloudinary.api.usage();

    // usage.credits holds { usage, limit }.
    const creditsUsed = usage.credits?.usage ?? 0;
    const creditsLimit = usage.credits?.limit ?? 0;

    // usage.resources is the total number of original assets.
    const resourcesCount =
      typeof usage.resources === "number" ? usage.resources : 0;

    // Sum the actual bytes of every original asset across all resource types.
    // This mirrors the per-type breakdown shown in the Cloudinary dashboard
    // (Image / Video / Raw), and the sum is the "used" storage.
    let imagesBytes = 0;
    let videosBytes = 0;
    let rawBytes = 0;
    let imagesCount = 0;
    let videosCount = 0;
    let rawCount = 0;
    try {
      const [img, vid, raw] = await Promise.all([
        sumResourcesByType("image"),
        sumResourcesByType("video"),
        sumResourcesByType("raw"),
      ]);
      imagesBytes = img.bytes;
      videosBytes = vid.bytes;
      rawBytes = raw.bytes;
      imagesCount = img.count;
      videosCount = vid.count;
      rawCount = raw.count;
    } catch {
      imagesBytes = videosBytes = rawBytes = 0;
    }

    const storageUsed = imagesBytes + videosBytes + rawBytes;

    return {
      storageUsed,
      storageLimit: FALLBACK_STORAGE_LIMIT,
      creditsUsed,
      creditsLimit,
      resourcesCount,
      imagesBytes,
      videosBytes,
      rawBytes,
      imagesCount,
      videosCount,
      rawCount,
    };
  } catch (error) {
    console.error("Cloudinary usage API error:", error);
    return {
      storageUsed: 0,
      storageLimit: FALLBACK_STORAGE_LIMIT,
      creditsUsed: 0,
      creditsLimit: 0,
      resourcesCount: 0,
    };
  }
}

export function getVideoUrl(publicId: string): string {
  return cloudinary.url(publicId, {
    resource_type: "video",
    quality: "auto",
    fetch_format: "auto",
    secure: true,
  });
}

export function getImageUrl(
  publicId: string,
  options: ImageTransformOptions = {},
): string {
  const opts = { ...BASE_TRANSFORM, ...options };
  return cloudinary.url(publicId, {
    transformation: [{ ...opts }],
    secure: true,
  });
}

export async function deleteFromCloudinaryUrl(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const match = url.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/(image|video)\/upload)\/(?:v\d+\/)?([^?#]+)$/);
  if (!match) return;
  const [, , resourceType, rest] = match;
  
  const pathParts = rest.split("/");
  const cleanedParts = pathParts.filter(part => !part.includes(","));
  const publicIdWithExt = cleanedParts.join("/");
  const publicId = publicIdWithExt.replace(/\.[^/.]+$/, "");
  
  try {
    await deleteFromCloudinary(publicId, resourceType);
  } catch (err) {
    console.error("Failed to delete parsed Cloudinary URL:", url, err);
  }
}
