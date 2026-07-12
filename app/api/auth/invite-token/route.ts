import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const { inviteToken } = await request.json();

    const expectedToken = (process.env.INVITE_TOKEN || "").trim();

    if (!inviteToken || typeof inviteToken !== "string") {
      return NextResponse.json(
        { error: "Token undangan tidak valid" },
        { status: 400 },
      );
    }

    if (!expectedToken || inviteToken.trim() !== expectedToken) {
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
