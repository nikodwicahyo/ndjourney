import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { sanitizeFileName, UPLOAD_FOLDER, validateUploadRequest } from "@/lib/upload-policy";

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
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const folder = (formData.get("folder") as string) || UPLOAD_FOLDER;

    if (!file || folder !== UPLOAD_FOLDER) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
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
    const resourceType = validation.policy.resourceType;
    const publicId = generatePublicId(file.name, session.user.id);

    const result = await new Promise<CloudinaryUploadResponse>((resolve, reject) => {
      const timeout = resourceType === "video" ? 300000 : 120000;
      const timeoutId = setTimeout(() => {
        reject(new Error(`Upload timeout after ${timeout / 1000}s`));
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
            reject(error || new Error("Upload failed"));
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}

function generatePublicId(fileName: string, userId: string): string {
  const safeFileName = sanitizeFileName(fileName);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);

  return `${userId}/${timestamp}-${random}-${safeFileName}`;
}
