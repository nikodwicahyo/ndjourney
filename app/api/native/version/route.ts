import { NextResponse } from "next/server";
import { MANIFEST_URL, NATIVE_REPO, parseRelease, type NativeRelease } from "@/lib/native/version";

// Public, non-secret: tells installed APKs whether a newer build exists.
// GitHub is contacted server-side so the web CSP `connect-src` stays unchanged.
const NO_STORE = { "Cache-Control": "private, no-store" };
const NONE: { data: NativeRelease | null } = { data: null };

export async function GET() {
  try {
    const res = await fetch(MANIFEST_URL, {
      next: { revalidate: 300 },
      headers: { Accept: "application/json", "User-Agent": "ndjourney-native-version/1" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return NextResponse.json(NONE, { headers: NO_STORE });

    const release = parseRelease(await res.json(), NATIVE_REPO);
    return NextResponse.json({ data: release }, { headers: NO_STORE });
  } catch {
    // No release yet / offline / hostile payload — the banner simply hides.
    return NextResponse.json(NONE, { headers: NO_STORE });
  }
}
