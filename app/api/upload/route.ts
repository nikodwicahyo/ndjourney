import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { uploadBufferToCloudinary } from "@/lib/cloudinary";
import { checkRateLimit } from "@/lib/redis";

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
        { error: "Upload limit reached. Try again later." },
        { status: 429 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Max 200MB." },
        { status: 400 },
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "File type not supported" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }

    const hex = buffer.subarray(0, 8).toString("hex");
    const validSignatures = MAGIC_BYTES[file.type];

    if (validSignatures && !validSignatures.some((sig) => hex.includes(sig))) {
      return NextResponse.json(
        { error: "File content does not match declared type" },
        { status: 400 },
      );
    }

    const result = await uploadBufferToCloudinary(buffer);

    return NextResponse.json({
      data: { ...result, isVideo: file.type.startsWith("video/") },
      rateLimit: { remaining },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 },
    );
  }
}