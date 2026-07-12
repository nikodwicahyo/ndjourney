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

export async function deleteFromCloudinary(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId);
}

export type CloudinaryUsage = {
  storageUsed: number;
  storageLimit: number;
  creditsUsed: number;
  creditsLimit: number;
  resourcesCount: number;
};

const FALLBACK_STORAGE_LIMIT =
  process.env.CLOUDINARY_STORAGE_LIMIT_BYTES
    ? Number(process.env.CLOUDINARY_STORAGE_LIMIT_BYTES)
    : 25 * 1024 * 1024 * 1024;

export async function getCloudinaryUsage(): Promise<CloudinaryUsage> {
  try {
    const usage = await cloudinary.api.usage();
    const storageUsed =
      usage.storage_usage_bytes ??
      usage.storage_usage ??
      usage.storage?.usage_bytes ??
      usage.storage?.usage ??
      0;
    const apiLimit =
      usage.storage_limit ??
      usage.storage?.limit ??
      0;
    const resourcesCount =
      usage.resources ??
      (usage.objects
        ? (usage.objects.images ?? 0) + (usage.objects.videos ?? 0) + (usage.objects.raw ?? 0)
        : 0);

    return {
      storageUsed,
      storageLimit: apiLimit > 0 ? apiLimit : FALLBACK_STORAGE_LIMIT,
      creditsUsed: usage.credits_usage ?? 0,
      creditsLimit: usage.credits_limit ?? 0,
      resourcesCount,
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
