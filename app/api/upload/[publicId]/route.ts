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
    // allowlist — unvalidated string flowed into cloudinary destroy.
    const resourceType = searchParams.get("resourceType") || "image";
    if (!["image", "video", "raw"].includes(resourceType)) {
      return NextResponse.json({ error: "resourceType tidak valid" }, { status: 400 });
    }

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
        { error: "Media tidak ditemukan untuk pengguna ini" },
        { status: 404 },
      );
    }

    await deleteFromCloudinary(publicId, resourceType);

    // Remove the metadata row too (same owner scope) — deleting only the
    // Cloudinary asset leaves an orphan row that no UI can display or
    // remove, and breaks callers that rely on this endpoint for full cleanup.
    await prisma.photo.deleteMany({
      where: { publicId, uploadedById: session.user.id },
    });

    return NextResponse.json({ data: { publicId } });
  } catch (error) {
    console.error("Error deleting from Cloudinary:", error);
    return NextResponse.json(
      { error: "Gagal menghapus file dari Cloudinary" },
      { status: 500 },
    );
  }
}
