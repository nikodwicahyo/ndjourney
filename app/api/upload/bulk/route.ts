import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { uploadBufferToCloudinary } from "@/lib/cloudinary";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { validateUploadRequest } from "@/lib/upload-policy";

export const runtime = "nodejs";

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

const MAX_FILES_PER_REQUEST = 30;

const MAGIC_BYTES: Record<string, string[]> = {
  "image/jpeg": ["ffd8ff"],
  "image/png": ["89504e47"],
  "image/webp": ["52494646"],
  "image/heic": ["00000018", "0000001c"],
  // Video formats have varied headers; use broader signatures + longer check
  "video/mp4": ["00000018", "0000001c", "66747970", "6d646174", "6d6f6f76", "77696465"],
  "video/webm": ["1a45dfa3"],
  "video/quicktime": ["66747970", "6d646174", "6d6f6f76", "77696465"],
  "video/x-msvideo": ["52494646"],
  "video/x-matroska": ["1a45dfa3"],
  "video/ogg": ["4f676753"],
  "video/mpeg": ["000001ba", "000001b3"],
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
  // ponytail: single source of truth for limits (10MB image / 100MB video), consistent with /sign + /server
  const policy = validateUploadRequest({ fileName: file.name, fileType: file.type, fileSize: file.size });
  if (!policy.valid) return policy.error;

  if (!ALLOWED_TYPES.includes(file.type)) {
    return `Format file tidak didukung: ${file.type}`;
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length === 0) {
    return `File kosong.`;
  }

  // Check more bytes for video files (up to 16 bytes) since headers vary
  const checkLength = file.type.startsWith("video/") ? 16 : 8;
  const hex = buffer.subarray(0, checkLength).toString("hex");
  const validSignatures = MAGIC_BYTES[file.type];

  if (validSignatures && !validSignatures.some((sig) => hex.includes(sig))) {
    console.warn("Magic bytes mismatch:", { fileName: file.name, fileType: file.type, hex: hex.substring(0, 32) });
    return `Isi file tidak sesuai dengan format yang dipilih: ${file.type}`;
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
      return NextResponse.json({ error: "Tidak ada file yang dikirim" }, { status: 400 });
    }

    if (files.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json(
        { error: `Terlalu banyak file. Maksimal ${MAX_FILES_PER_REQUEST} per permintaan.` },
        { status: 400 },
      );
    }

    const albumId = formData.get("albumId") as string | null;

    // ponytail: per-file catch — one corrupt arrayBuffer must not 500 the whole batch
    const validationResults = await Promise.all(
      files.map(async (file) => {
        try {
          const validation = await validateAndPrepareFile(file);
          return { file, validation };
        } catch (e) {
          return { file, validation: e instanceof Error ? e.message : "Validasi gagal" as const };
        }
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

    // ponytail: each item catches its own error so identity is never lost (no "unknown", no fail-all)
    for (let i = 0; i < validFiles.length; i += CONCURRENCY) {
      const batch = validFiles.slice(i, i + CONCURRENCY);

      const batchResults: BulkUploadResult[] = await Promise.all(
        batch.map(async ({ file, buffer, isVideo }) => {
          try {
            const cloudinaryResult = await uploadBufferToCloudinary(buffer, "ndjourney-web", isVideo);
            return {
              fileName: file.name,
              success: true,
              result: { ...cloudinaryResult, isVideo, fileSize: file.size },
            } satisfies BulkUploadResult;
          } catch (e) {
            return {
              fileName: file.name,
              success: false,
              error: e instanceof Error ? e.message : "Upload gagal",
            } satisfies BulkUploadResult;
          }
        }),
      );
      results.push(...batchResults);
    }

    return NextResponse.json({
      results,
      rateLimit: { remaining: rateCheck.remaining },
    });
  } catch (error) {
    console.error("Bulk upload error:", error);
    const message = error instanceof Error ? error.message : "Upload massal gagal";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}