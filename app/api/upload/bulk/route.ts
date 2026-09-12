import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { uploadBufferToCloudinary } from "@/lib/cloudinary";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { validateUploadRequest } from "@/lib/upload-policy";
import { checkMagicBytes } from "@/lib/upload-magic";

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

  // ponytail: shared magic-bytes table (lib/upload-magic) incl. audio/mpeg.
  if (!checkMagicBytes(buffer, file.type)) {
    console.warn("Magic bytes mismatch:", { fileName: file.name, fileType: file.type });
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
    // ponytail: never leak SDK internals on 500 (per-item messages stay actionable).
    return NextResponse.json(
      { error: "Upload massal gagal. Coba lagi nanti." },
      { status: 500 },
    );
  }
}