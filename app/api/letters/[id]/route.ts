import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { invalidateCache } from "@/lib/redis";
import { getLetterDetail } from "@/lib/queries/letter";
import { getUserCoupleId } from "@/lib/couple";
import { triggerCoupleEvent } from "@/lib/pusher-server";


export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const result = await getLetterDetail(session.user.id, id);
    if (result.status === "not_found") {
      return NextResponse.json({ error: "Surat tidak ditemukan" }, { status: 404 });
    }
    if (result.status === "forbidden") {
      return NextResponse.json({ error: "Kamu tidak punya akses untuk melihat surat ini" }, { status: 403 });
    }

    // HTTP envelope only — getLetterDetail returns the letter payload itself.
    return NextResponse.json({ data: result.data }, {
      headers: { "Cache-Control": "private, no-cache" },
    });
  } catch (error) {
    console.error("Error fetching letter:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const letter = await prisma.letter.findUnique({
      where: { id },
      select: { id: true, authorId: true },
    });

    if (!letter) {
      return NextResponse.json({ error: "Surat tidak ditemukan" }, { status: 404 });
    }

    if (letter.authorId !== session.user.id) {
      return NextResponse.json({ error: "Kamu tidak punya akses untuk menghapus surat ini" }, { status: 403 });
    }

    await prisma.letter.delete({ where: { id } });

    await invalidateCache("letters:*");
    await invalidateCache("dashboard:*");
    await invalidateCache("home:*");

    const coupleId = await getUserCoupleId(session.user.id);
    if (coupleId) {
      triggerCoupleEvent(coupleId, 'LETTERS');
    }

    return NextResponse.json({ data: { id } });
  } catch (error) {
    console.error("Error deleting letter:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
