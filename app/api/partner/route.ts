import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await prisma.coupleMember.findUnique({
      where: { userId: session.user.id },
      select: {
        couple: {
          select: {
            members: {
              where: { userId: { not: session.user.id } },
              select: {
                user: { select: { id: true, name: true, email: true, image: true } },
              },
            },
          },
        },
      },
    });

    const partner = membership?.couple?.members?.[0]?.user ?? null;

    if (!partner) {
      return NextResponse.json(
        { error: "No partner found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: partner });
  } catch (error) {
    console.error("Error fetching partner:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
