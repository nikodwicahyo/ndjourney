import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { withAnonymousRateLimit } from "@/lib/rate-limit";
import { safeTokenEqual } from "@/lib/api-body";

export async function POST(request: Request) {
  try {
    // ponytail: single static secret — throttle per-IP or it's a brute-force oracle.
    const rl = await withAnonymousRateLimit(request, { maxRequests: 10, windowSeconds: 900, keyPrefix: "invite" });
    if (!rl.allowed) return rl.response ?? NextResponse.json({ error: "Terlalu banyak permintaan. Coba lagi nanti." }, { status: 429 });

    const __b = await request.json().catch(() => null);
    if (__b == null || typeof __b !== "object") return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
    const { inviteToken } = __b as { inviteToken?: string };

    const expectedToken = (process.env.INVITE_TOKEN || "").trim();

    if (!inviteToken || typeof inviteToken !== "string") {
      return NextResponse.json(
        { error: "Token undangan tidak valid" },
        { status: 400 },
      );
    }

    if (!expectedToken || !safeTokenEqual(inviteToken.trim(), expectedToken)) {
      return NextResponse.json(
        { error: "Token undangan tidak valid" },
        { status: 403 },
      );
    }

    const cookieStore = await cookies();
    cookieStore.set("invite_token", inviteToken.trim(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 30,
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Invite token error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
