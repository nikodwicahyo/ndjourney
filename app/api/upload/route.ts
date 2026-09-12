import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { uploadBufferToCloudinary } from "@/lib/cloudinary";
import { checkRateLimit } from "@/lib/redis";
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

// ponytail: aligned with upload-policy (10 MB image / 100 MB video).
const MAX_SIZE = 100 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { allowed, remaining } = await checkRateLimit(
      `upload:${session.user.id}`,
      20,
      3600,
    );

    if (!allowed) {
      return NextResponse.json(
        { error: "Batas upload tercapai. Coba lagi nanti." },
        { status: 429 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Tidak ada file yang dikirim" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Ukuran file terlalu besar. Maksimal 100MB." },
        { status: 400 },
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Format file tidak didukung" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length === 0) {
      return NextResponse.json({ error: "File kosong" }, { status: 400 });
    }

    // ponytail: verify bytes match the claimed type (shared table in lib/upload-magic).
    if (!checkMagicBytes(buffer, file.type)) {
      console.warn("Magic bytes mismatch:", { fileName: file.name, fileType: file.type });
      return NextResponse.json(
        { error: "Isi file tidak sesuai dengan format yang dipilih" },
        { status: 400 },
      );
    }

    const result = await uploadBufferToCloudinary(buffer, "ndjourney-web", file.type.startsWith("video/"));

    return NextResponse.json({
      data: {
        ...result,
        isVideo: file.type.startsWith("video/"),
        fileSize: file.size,
      },
      rateLimit: { remaining },
    });
  } catch (error) {
    console.error("Upload error:", error);
    // ponytail: never leak Cloudinary/SDK internals to the client.
    return NextResponse.json(
      { error: "Upload gagal. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
