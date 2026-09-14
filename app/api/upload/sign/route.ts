import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getChunkSize } from "@/lib/upload-config";
import { UPLOAD_FOLDER, validateUploadRequest } from "@/lib/upload-policy";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rateCheck = await withRateLimit(request, { maxRequests: 120, windowSeconds: 3600, keyPrefix: "upload:sign" });
    if (!rateCheck.allowed) {
      return rateCheck.response;
    }

    const session = rateCheck.session;

    // ponytail: fail closed with 503, not a TypeError 500 on `!`.
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return NextResponse.json({ error: "Layanan upload belum dikonfigurasi" }, { status: 503 });
    }

    const body = await request.json().catch(() => null);
    if (body == null) return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
    const { fileName, fileSize, fileType, folder = UPLOAD_FOLDER } = body;

    if (!fileName || !fileSize || !fileType || folder !== UPLOAD_FOLDER) {
      return NextResponse.json(
        { error: "Parameter yang dibutuhkan tidak lengkap" },
        { status: 400 }
      );
    }

    const numericFileSize = Number(fileSize);
    // ponytail: NaN / non-finite must 400 here, not leak into chunk math.
    if (!Number.isFinite(numericFileSize) || numericFileSize <= 0) {
      return NextResponse.json(
        { error: "Ukuran file tidak valid" },
        { status: 400 }
      );
    }
    const validation = validateUploadRequest({ fileName, fileType, fileSize: numericFileSize });
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = generatePublicId(session.user.id);
    const resourceType = validation.policy.resourceType;
    
    // Use the same chunk size calculation as the client
    const chunkSize = getChunkSize(numericFileSize);
    const totalChunks = Math.ceil(numericFileSize / chunkSize);

    // Build params for signing - Cloudinary only expects these 4 params for direct upload to /{resource_type}/upload
    // resource_type is in the URL path, not in the signed params
    // chunk_size and total_chunks are sent in form data but NOT included in the signature
    const paramsToSign: Record<string, string> = {
      public_id: publicId,
      folder,
      type: "upload",
      timestamp: String(timestamp),
    };

    const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET!);

    const uploadParams = {
      ...paramsToSign,
      signature,
      api_key: process.env.CLOUDINARY_API_KEY!,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    };

    const uploadUrl = `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

    return NextResponse.json({
      uploadUrl,
      uploadParams,
      chunkSize,
      totalChunks,
      publicId,
      resourceType,
    });
  } catch (error) {
    console.error("Sign upload error:", error);
    return NextResponse.json(
      { error: "Gagal membuat tanda tangan upload" },
      { status: 500 }
    );
  }
}

function generatePublicId(userId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  // ponytail: no original extension — Cloudinary appends the delivery format,
  // so keeping it produced urls like name.webp.webp.
  return `${userId}/${timestamp}-${random}`;
}
