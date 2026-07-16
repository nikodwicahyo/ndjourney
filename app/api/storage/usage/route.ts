import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getCloudinaryUsage } from "@/lib/cloudinary";
import { getCached, setCached, cacheKey, checkRateLimit } from "@/lib/redis";
import type { CloudinaryUsage } from "@/types";

const CACHE_TTL = 60;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { allowed } = await checkRateLimit(
      `storage:usage:${session.user.id}`,
      120,
      3600,
    );

    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 },
      );
    }

    const cacheK = cacheKey("storage", "usage");
    const cached = await getCached<CloudinaryUsage>(cacheK);
    if (cached) {
      return NextResponse.json({ data: cached });
    }

    const usage = await getCloudinaryUsage();
    await setCached(cacheK, usage, CACHE_TTL);

    return NextResponse.json({ data: usage });
  } catch (error) {
    console.error("Error fetching storage usage:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
