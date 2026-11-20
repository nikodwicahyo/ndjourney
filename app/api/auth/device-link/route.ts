import { NextResponse } from "next/server";
import { rateLimitConfigs, withRateLimit } from "@/lib/rate-limit";
import { createDeviceLink, revokeDeviceLinks } from "@/lib/device-link";

const NO_STORE = { "Cache-Control": "private, no-store" };

/** Mint a one-time code for signing in from the native app. */
export async function POST(request: Request) {
  const rl = await withRateLimit(request, rateLimitConfigs.auth);
  if (!rl.allowed) {
    return rl.response ?? NextResponse.json({ error: "Terlalu banyak permintaan" }, { status: 429 });
  }

  try {
    const { code, expiresAt } = await createDeviceLink(rl.session.user.id);
    return NextResponse.json({ data: { code, expiresAt } }, { headers: NO_STORE });
  } catch (error) {
    console.error("[device-link] create failed:", error);
    return NextResponse.json(
      { error: "Gagal membuat kode perangkat" },
      { status: 500, headers: NO_STORE },
    );
  }
}

/** Revoke outstanding codes (the "Batalkan kode" button). */
export async function DELETE(request: Request) {
  const rl = await withRateLimit(request, rateLimitConfigs.auth);
  if (!rl.allowed) {
    return rl.response ?? NextResponse.json({ error: "Terlalu banyak permintaan" }, { status: 429 });
  }

  try {
    await revokeDeviceLinks(rl.session.user.id);
    return NextResponse.json({ data: { revoked: true } }, { headers: NO_STORE });
  } catch (error) {
    console.error("[device-link] revoke failed:", error);
    return NextResponse.json(
      { error: "Gagal membatalkan kode" },
      { status: 500, headers: NO_STORE },
    );
  }
}
