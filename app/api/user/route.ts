import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { NextResponse } from "next/server";
import { updateUserSchema } from "@/lib/validations/user";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";

export async function PUT(request: Request) {
  try {
    const rateCheck = await withRateLimit(request, rateLimitConfigs.write);
    if (!rateCheck.allowed) {
      return rateCheck.response;
    }

    const session = rateCheck.session;

    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 },
      );
    }

    const { name, image } = parsed.data;

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(name !== undefined && { name }),
        ...(image !== undefined && { image }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
      },
    });

    // Invalidate session caches so next session fetch gets fresh data
    if (redis) {
      const userSessions = await prisma.session.findMany({
        where: { userId: session.user.id },
        select: { sessionToken: true },
      });

      for (const s of userSessions) {
        await redis.del(`cache:session:${s.sessionToken}`);
      }
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
