import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { invalidateCache } from "@/lib/redis";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const rateCheck = await withRateLimit(request, rateLimitConfigs.note);
    if (!rateCheck.allowed) {
      return rateCheck.response;
    }

    const session = rateCheck.session;
    const { id } = await params;

    const note = await prisma.dailyNote.findUnique({
      where: { id },
      select: { authorId: true },
    });

    if (!note) {
      return NextResponse.json(
        { error: "Catatan tidak ditemukan" },
        { status: 404 },
      );
    }

    if (note.authorId !== session.user.id) {
      return NextResponse.json(
        { error: "Kamu tidak memiliki akses untuk menghapus catatan ini" },
        { status: 403 },
      );
    }

    await prisma.dailyNote.delete({ where: { id } });

    await invalidateCache("notes:*");

    return NextResponse.json({ message: "Catatan berhasil dihapus" });
  } catch (error) {
    console.error("Error deleting note:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
