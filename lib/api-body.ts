import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

/**
 * Parse request JSON body safely.
 * Malformed / empty bodies resolve to `null` instead of throwing,
 * so routes can return 400 instead of leaking a 500.
 */
// ponytail: single shared guard; use in every route that reads JSON.
export async function parseJsonBody<T = unknown>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

/** 400 response for invalid JSON bodies. */
export function invalidJsonResponse(message = "Body JSON tidak valid") {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * Map known operational errors to HTTP responses.
 * Returns null when the error is not recognised (caller falls back to 500).
 */
export function toKnownErrorResponse(error: unknown): NextResponse | null {
  const code = (error as { code?: string })?.code;
  if (code === "P2002") {
    return NextResponse.json(
      { error: "Data sudah ada (duplikat). Coba lagi." },
      { status: 409 },
    );
  }
  if (error instanceof SyntaxError) {
    return invalidJsonResponse();
  }
  return null;
}

/** Wrap an outer catch: known errors get proper status, rest 500. */
export function handleApiError(error: unknown, fallback = "Terjadi kesalahan pada server. Coba lagi nanti.") {
  const known = toKnownErrorResponse(error);
  if (known) return known;
  console.error("[API_ERROR]", error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

/**
 * Constant-time string compare for shared secrets (invite tokens).
 * Plain `!==` leaks prefix info via timing; length check first.
 */
// ponytail: single helper — invite-token + register must compare identically.
export function safeTokenEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && ab.length > 0 && timingSafeEqual(ab, bb);
}
