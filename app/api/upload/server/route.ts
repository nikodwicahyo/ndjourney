import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { sanitizeFileName, UPLOAD_FOLDER, validateUploadRequest } from "@/lib/upload-policy";
import { checkMagicBytes } from "@/lib/upload-magic";
import { withRateLimit } from "@/lib/rate-limit";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const runtime = "nodejs";
export const maxDuration = 300;

type CloudinaryUploadResponse = {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  resource_type: string;
};

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

export async function POST(request: Request) {
  try {
    const rateCheck = await withRateLimit(request, { maxRequests: 30, windowSeconds: 3600, keyPrefix: "upload:server" });
    if (!rateCheck.allowed) {
      return rateCheck.response;
    }

    const session = rateCheck.session;

    // ponytail: fail closed with 503, not a TypeError 500 downstream.
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return NextResponse.json({ error: "Layanan upload belum dikonfigurasi" }, { status: 503 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const folder = (formData.get("folder") as string) || UPLOAD_FOLDER;

    // ponytail: instanceof guard — string field named "file" must 400, not throw on .arrayBuffer().
    if (!(file instanceof File) || file.size === 0 || folder !== UPLOAD_FOLDER) {
      return NextResponse.json({ error: "Tidak ada file yang dikirim" }, { status: 400 });
    }

    const validation = validateUploadRequest({
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    });
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length === 0) {
      return NextResponse.json({ error: "File kosong" }, { status: 400 });
    }

    // ponytail: bytes are proxied here, so sniffing is cheap — spoofed MIME rejected.
    if (!checkMagicBytes(buffer, file.type)) {
      return NextResponse.json({ error: "Isi file tidak sesuai dengan format yang dipilih" }, { status: 400 });
    }

    const resourceType = validation.policy.resourceType;
    const publicId = generatePublicId(file.name, session.user.id);

    const result = await new Promise<CloudinaryUploadResponse>((resolve, reject) => {
      const timeout = resourceType === "video" ? 300000 : 120000;
      const timeoutId = setTimeout(() => {
        reject(new Error(`Waktu upload habis setelah ${timeout / 1000} detik`));
      }, timeout);

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          resource_type: resourceType,
          transformation: [
            { quality: "auto:good", fetch_format: "auto", flags: "lossy" },
          ],
        },
        (error, result) => {
          clearTimeout(timeoutId);
          if (error || !result) {
            reject(error || new Error("Upload gagal"));
            return;
          }
          resolve({
            secure_url: result.secure_url,
            public_id: result.public_id,
            width: result.width,
            height: result.height,
            format: result.format,
            bytes: result.bytes,
            resource_type: result.resource_type,
          });
        }
      );

      uploadStream.end(buffer);
    });

    const thumbnailUrl = getThumbnailUrl(result);

    return NextResponse.json({
      url: result.secure_url,
      publicId: result.public_id,
      secureUrl: result.secure_url,
      thumbnailUrl,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
      isVideo: result.resource_type === "video",
      fileSize: buffer.length,
    });
  } catch (error) {
    console.error("Server upload error:", error);
    // ponytail: never leak Cloudinary/SDK internals to the client.
    return NextResponse.json(
      { error: "Upload gagal. Coba lagi nanti." },
      { status: 500 }
    );
  }
}

function generatePublicId(fileName: string, userId: string): string {
  const safeFileName = sanitizeFileName(fileName).replace(/\.[^.]+$/, "");
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);

  // ponytail: no original extension — Cloudinary appends the delivery format,
  // so keeping it produced urls like name.jpg.jpg.
  return `${userId}/${timestamp}-${random}-${safeFileName}`;
}
