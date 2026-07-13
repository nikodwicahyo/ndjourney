import { NextResponse } from "next/server";
import { deleteFromCloudinary } from "@/lib/cloudinary";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { publicIdBelongsToUser } from "@/lib/upload-policy";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    const rateCheck = await withRateLimit(request, rateLimitConfigs.write);
    if (!rateCheck.allowed) {
      return rateCheck.response;
    }

    const session = rateCheck.session;
    const { publicId } = await params;
    const { searchParams } = new URL(request.url);
    const resourceType = searchParams.get("resourceType") || "image";

    if (!publicId) {
      return NextResponse.json(
        { error: "publicId is required" },
        { status: 400 },
      );
    }

    if (!publicIdBelongsToUser(publicId, session.user.id)) {
      return NextResponse.json(
        { error: "Invalid publicId format" },
        { status: 400 },
      );
    }

    const photo = await prisma.photo.findFirst({
      where: { publicId, uploadedById: session.user.id },
      select: { id: true },
    });

    if (!photo) {
      return NextResponse.json(
        { error: "No matching media found for this user" },
        { status: 404 },
      );
    }

    await deleteFromCloudinary(publicId, resourceType);

    return NextResponse.json({ message: "File deleted from Cloudinary" });
  } catch (error) {
    console.error("Error deleting from Cloudinary:", error);
    return NextResponse.json(
      { error: "Failed to delete file from Cloudinary" },
      { status: 500 },
    );
  }
}
