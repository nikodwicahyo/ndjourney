import { prisma, sql } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { updatePhotoSchema } from "@/lib/validations/photo";
import { deleteFromCloudinary } from "@/lib/cloudinary";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { getCached, setCached, invalidateCache, cacheKey } from "@/lib/redis";
import { auth } from "@/lib/auth";

const CACHE_TTL = 120;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const cacheK = cacheKey("photos", "detail", id);
    const cached = await getCached<unknown>(cacheK);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
      });
    }

    const photo = await prisma.photo.findUnique({
      where: { id },
      select: {
        id: true,
        url: true,
        publicId: true,
        thumbnailUrl: true,
        caption: true,
        takenAt: true,
        width: true,
        height: true,
        isVideo: true,
        isFavorite: true,
        albumId: true,
        uploadedById: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    const response = { data: photo };

    await setCached(cacheK, response, CACHE_TTL);

    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("Error fetching photo:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const rateCheck = await withRateLimit(request, rateLimitConfigs.write);
    if (!rateCheck.allowed) {
      return rateCheck.response;
    }

    const { id } = await params;
    const userId = rateCheck.session.user.id;

    const existing = await prisma.photo.findUnique({
      where: { id },
      select: { uploadedById: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }
    if (existing.uploadedById !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updatePhotoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 },
      );
    }

    const ALLOWED_COLUMNS = new Set(["caption", "albumId", "isFavorite"]);

    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined && ALLOWED_COLUMNS.has(key)) {
        updateData[key] = value;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const photo = await prisma.photo.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        url: true,
        publicId: true,
        thumbnailUrl: true,
        caption: true,
        takenAt: true,
        width: true,
        height: true,
        isVideo: true,
        isFavorite: true,
        albumId: true,
        uploadedById: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    await invalidateCache("photos:*");

    return NextResponse.json({ data: photo });
  } catch (error) {
    console.error("Error updating photo:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const rateCheck = await withRateLimit(request, rateLimitConfigs.write);
    if (!rateCheck.allowed) {
      return rateCheck.response;
    }

    const { id } = await params;
    const userId = rateCheck.session.user.id;

    const photo = await prisma.photo.findUnique({
      where: { id },
      select: { publicId: true, uploadedById: true },
    });

    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }
    if (photo.uploadedById !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await Promise.all([
      deleteFromCloudinary(photo.publicId),
      prisma.photo.delete({ where: { id } }),
    ]);

    await invalidateCache("photos:*");

    return NextResponse.json({ message: "Photo deleted" });
  } catch (error) {
    console.error("Error deleting photo:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}