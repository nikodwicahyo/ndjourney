import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { updateWishSchema } from "@/lib/validations/wish";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { invalidateCache } from "@/lib/redis";


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
    const body = await request.json();
    const parsed = updateWishSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 },
      );
    }

    const data: Record<string, unknown> = { ...parsed.data };
    if (data.isDone === true) {
      data.doneAt = new Date();
    }

    const wish = await prisma.wishItem.update({
      where: { id },
      data,
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        link: true,
        category: true,
        isDone: true,
        doneAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await invalidateCache("wishes:*");

    return NextResponse.json({ data: wish });
  } catch (error) {
    console.error("Error updating wish:", error);
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

    await prisma.wishItem.delete({ where: { id } });

    await invalidateCache("wishes:*");

    return NextResponse.json({ message: "Wish deleted" });
  } catch (error) {
    console.error("Error deleting wish:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
