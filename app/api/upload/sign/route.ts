import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getChunkSize } from "@/lib/upload-config";
import { sanitizeFileName, UPLOAD_FOLDER, validateUploadRequest } from "@/lib/upload-policy";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { fileName, fileSize, fileType, folder = UPLOAD_FOLDER } = body;

    if (!fileName || !fileSize || !fileType || folder !== UPLOAD_FOLDER) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const numericFileSize = Number(fileSize);
    const validation = validateUploadRequest({ fileName, fileType, fileSize: numericFileSize });
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = generatePublicId(fileName, session.user.id);
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
      { error: "Failed to generate upload signature" },
      { status: 500 }
    );
  }
}

function generatePublicId(fileName: string, userId: string): string {
  const safeFileName = sanitizeFileName(fileName);
  const ext = safeFileName.split(".").pop()?.toLowerCase() || "dat";
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `${userId}/${timestamp}-${random}.${ext}`;
}
