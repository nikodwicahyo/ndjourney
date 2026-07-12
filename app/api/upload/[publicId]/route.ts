import { NextResponse } from "next/server";
import { deleteFromCloudinary } from "@/lib/cloudinary";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    const rateCheck = await withRateLimit(request, rateLimitConfigs.write);
    if (!rateCheck.allowed) {
      return rateCheck.response;
    }

    const { publicId } = await params;

    if (!publicId) {
      return NextResponse.json(
        { error: "publicId is required" },
        { status: 400 },
      );
    }

    await deleteFromCloudinary(publicId);

    return NextResponse.json({ message: "File deleted from Cloudinary" });
  } catch (error) {
    console.error("Error deleting from Cloudinary:", error);
    return NextResponse.json(
      { error: "Failed to delete file from Cloudinary" },
      { status: 500 },
    );
  }
}
