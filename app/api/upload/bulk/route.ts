import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { uploadBufferToCloudinary } from "@/lib/cloudinary";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-msvideo",
  "video/x-matroska",
  "video/ogg",
  "video/mpeg",
  "audio/mpeg",
];

const MAX_SIZE = 200 * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 30;

const MAGIC_BYTES: Record<string, string[]> = {
  "image/jpeg": ["ffd8ff"],
  "image/png": ["89504e47"],
  "image/webp": ["52494646"],
  "image/heic": ["00000018", "0000001c"],
  "video/mp4": ["00000018", "0000001c", "66747970"],
  "video/webm": ["1a45dfa3"],
  "video/quicktime": ["66747970"],
  "video/x-msvideo": ["52494646"],
  "video/x-matroska": ["1a45dfa3"],
  "video/ogg": ["4f676753"],
  "video/mpeg": ["000001ba"],
};

type BulkUploadResult = {
  fileName: string;
  success: boolean;
  result?: {
    url: string;
    publicId: string;
    thumbnailUrl: string;
    width: number;
    height: number;
    format: string;
    bytes: number;
    isVideo?: boolean;
    fileSize: number;
  };
  error?: string;
};

async function validateAndPrepareFile(file: File): Promise<{ buffer: Buffer; isVideo: boolean } | string> {
  if (file.size > MAX_SIZE) {
    return `File too large. Max 200MB.`;
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return `File type not supported: ${file.type}`;
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length === 0) {
    return `Empty file.`;
  }

  const hex = buffer.subarray(0, 8).toString("hex");
  const validSignatures = MAGIC_BYTES[file.type];

  if (validSignatures && !validSignatures.some((sig) => hex.includes(sig))) {
    return `File content does not match declared type: ${file.type}`;
  }

  return { buffer, isVideo: file.type.startsWith("video/") };
}

export async function POST(request: Request) {
  try {
    const rateCheck = await withRateLimit(request, rateLimitConfigs.bulkUpload);
    if (!rateCheck.allowed) {
      return rateCheck.response;
    }

    const session = rateCheck.session;

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    if (files.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json(
        { error: `Too many files. Maximum ${MAX_FILES_PER_REQUEST} per request.` },
        { status: 400 },
      );
    }

    const albumId = formData.get("albumId") as string | null;

    const validationResults = await Promise.all(
      files.map(async (file) => {
        const validation = await validateAndPrepareFile(file);
        return { file, validation };
      }),
    );

    const validFiles: Array<{ file: File; buffer: Buffer; isVideo: boolean }> = [];
    const results: BulkUploadResult[] = [];

    for (const { file, validation } of validationResults) {
      if (typeof validation === "string") {
        results.push({
          fileName: file.name,
          success: false,
          error: validation,
        });
      } else {
        validFiles.push({ file, buffer: validation.buffer, isVideo: validation.isVideo });
      }
    }

    const CONCURRENCY = 3;

    for (let i = 0; i < validFiles.length; i += CONCURRENCY) {
      const batch = validFiles.slice(i, i + CONCURRENCY);

      const batchResults = await Promise.allSettled(
        batch.map(async ({ file, buffer, isVideo }) => {
          const cloudinaryResult = await uploadBufferToCloudinary(buffer);

          return {
            fileName: file.name,
            success: true,
            result: {
              ...cloudinaryResult,
              isVideo,
              fileSize: file.size,
            },
          } satisfies BulkUploadResult;
        }),
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          results.push({
            fileName: "unknown",
            success: false,
            error: result.reason instanceof Error ? result.reason.message : "Upload failed",
          });
        }
      }
    }

    results.sort((a, b) => {
      const aIndex = files.findIndex((f) => f.name === a.fileName);
      const bIndex = files.findIndex((f) => f.name === b.fileName);
      return aIndex - bIndex;
    });

    return NextResponse.json({
      results,
      rateLimit: { remaining: rateCheck.remaining },
    });
  } catch (error) {
    console.error("Bulk upload error:", error);
    return NextResponse.json(
      { error: "Bulk upload failed" },
      { status: 500 },
    );
  }
}