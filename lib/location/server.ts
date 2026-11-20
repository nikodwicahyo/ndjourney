import type { Prisma } from "@/lib/generated/prisma";
import { haversineMeters } from "@/lib/geo";

/** Faster than any commercial aircraft; beyond this a fix is telemetry noise. */
export const MAX_PLAUSIBLE_SPEED_MPS = 100;

export type ShareCheck =
  | { ok: true; coupleId: string; trackingState: string | null }
  | { ok: false; code: "disabled" | "expired" };

/**
 * The single share gate for every write endpoint.
 *
 * Lazy expiry happens inside the caller's transaction on purpose: returning
 * (instead of throwing) lets the opt-out commit before the 403 is sent. A
 * thrown error would roll it back and the share would stay "expired forever".
 */
export async function checkActiveShare(
  db: Prisma.TransactionClient,
  userId: string,
  now: Date,
): Promise<ShareCheck> {
  const share = await db.locationShare.findUnique({
    where: { userId },
    select: { coupleId: true, isSharing: true, expiresAt: true, trackingState: true },
  });

  if (!share?.isSharing) return { ok: false, code: "disabled" };

  if (share.expiresAt && share.expiresAt.getTime() <= now.getTime()) {
    await db.locationShare.update({
      where: { userId },
      data: { isSharing: false, expiresAt: null, trackingState: "stopped" },
    });
    await db.userLocation.deleteMany({ where: { userId } });
    return { ok: false, code: "expired" };
  }

  return { ok: true, coupleId: share.coupleId, trackingState: share.trackingState };
}

/** Reject impossible jumps from history without blocking the live pin. */
export function isPlausibleFix(
  previous: { latitude: number; longitude: number; updatedAt: Date },
  next: { latitude: number; longitude: number },
  at: Date,
): boolean {
  const seconds = (at.getTime() - previous.updatedAt.getTime()) / 1000;
  // A device clock can be slightly behind the server's; an out-of-order fix
  // is a dedupe concern, not proof of teleportation.
  if (seconds <= 0) return true;
  return haversineMeters(previous, next) / seconds <= MAX_PLAUSIBLE_SPEED_MPS;
}

/** JSON or `text/plain` (sendBeacon) — both carry a JSON body. */
export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return JSON.parse(await request.text());
  } catch {
    return null;
  }
}

export function shareError(code: "disabled" | "expired") {
  return {
    status: 403 as const,
    body: {
      error:
        code === "expired"
          ? "Masa berbagi lokasi telah berakhir"
          : "Kamu belum mengaktifkan berbagi lokasi",
      code,
    },
  };
}
