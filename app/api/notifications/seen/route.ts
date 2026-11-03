import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getUserCoupleId } from "@/lib/couple";

export async function POST(_request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const me = session.user.id;
    const coupleId = await getUserCoupleId(me);
    if (!coupleId) {
      return NextResponse.json(
        { error: "Akun belum terhubung ke couple. Coba muat ulang." },
        { status: 409 },
      );
    }

    await prisma.coupleMember.update({
      where: { userId: me },
      data: { lastSeenActivityAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error marking notifications seen:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
