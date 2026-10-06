import { cloudinary } from "./cloudinary";
import {
  ALLOWED_IMAGE_FORMATS,
  ALLOWED_VIDEO_FORMATS,
  deliveryKind,
  isAllowedCloudinaryUrl,
  maxBytesForKind,
  publicIdBelongsToUser,
  type MediaDeliveryKind,
} from "./upload-policy";

// Pre-save asset verification for the direct-to-Cloudinary path.
// /api/upload/sign only sees claimed metadata, and its signature does not
// bind resource_type — so before persisting a client-returned URL we confirm
// against the Admin API (authoritative, not client-claimed): the asset
// exists, its kind matches the claimed isVideo flag, its detected format is
// allowlisted, and its bytes fit the policy. One module, used by
// POST /api/photos and both milestone photoUpload paths.
export class UploadVerifyError extends Error {
  status: 400 | 503;
  constructor(message: string, status: 400 | 503 = 400) {
    super(message);
    this.status = status;
  }
}

export type VerifiedAsset = {
  resourceType: MediaDeliveryKind;
  format: string;
  bytes: number;
};

type AdminResource = {
  resource_type?: string;
  format?: string;
  bytes?: number;
};

async function fetchAsset(publicId: string): Promise<AdminResource | null> {
  // raw assets are never valid gallery media — don't even look them up.
  for (const resourceType of ["image", "video"] as const) {
    try {
      return (await cloudinary.api.resource(publicId, {
        resource_type: resourceType,
      })) as AdminResource;
    } catch (e: unknown) {
      const httpCode = (e as { httpCode?: number; error?: { http_code?: number } })?.httpCode
        ?? (e as { error?: { http_code?: number } })?.error?.http_code;
      if (httpCode === 404) continue; // not this kind — try the other
      throw new UploadVerifyError("Gagal memverifikasi media. Coba lagi nanti.", 503);
    }
  }
  return null;
}

export async function verifyUploadForSave(input: {
  url: string;
  publicId: string;
  userId: string;
  isVideo: boolean;
}): Promise<VerifiedAsset> {
  const { url, publicId, userId, isVideo } = input;

  // static checks first — no Admin API call for malformed/foreign URLs.
  if (!isAllowedCloudinaryUrl(url) || !publicIdBelongsToUser(publicId, userId)) {
    throw new UploadVerifyError("Media tidak valid atau tidak diizinkan");
  }
  const kind = deliveryKind(url);
  if (kind === null) {
    throw new UploadVerifyError("Media tidak valid atau tidak diizinkan");
  }
  if ((kind === "video") !== isVideo) {
    throw new UploadVerifyError("Jenis media tidak sesuai");
  }

  const asset = await fetchAsset(publicId);
  if (!asset) {
    // phantom row guard — never persist metadata for bytes that aren't there.
    throw new UploadVerifyError("Media tidak ditemukan. Unggah ulang file.");
  }

  const detectedKind: MediaDeliveryKind | null =
    asset.resource_type === "video" ? "video" : asset.resource_type === "image" ? "image" : null;
  if (detectedKind === null || detectedKind !== kind) {
    throw new UploadVerifyError("Jenis media tidak sesuai");
  }

  const format = String(asset.format ?? "").toLowerCase();
  const allowed = detectedKind === "video" ? ALLOWED_VIDEO_FORMATS : ALLOWED_IMAGE_FORMATS;
  if (!allowed.includes(format)) {
    throw new UploadVerifyError("Format media tidak diizinkan");
  }

  const bytes = Number(asset.bytes ?? NaN);
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > maxBytesForKind(detectedKind)) {
    throw new UploadVerifyError("Ukuran media melebihi batas");
  }

  return { resourceType: detectedKind, format, bytes };
}
