import { outbox as defaultOutbox, type Outbox } from "./outbox";
import type { LocationFix } from "./types";

export type DeliveryResult = "ok" | "retry" | "drop";

/** The server will never accept these, so keeping them only blocks the queue. */
const PERMANENT_FAILURES = new Set([400, 403, 404, 409, 410, 413, 415, 422]);

const isOk = (status: number) => status >= 200 && status < 300;

let flushing = false;

async function deliver(fix: LocationFix): Promise<DeliveryResult> {
  try {
    const res = await fetch("/api/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fix),
      // Survives tab freeze/unload; a normal request can be dropped there.
      keepalive: true,
      credentials: "same-origin",
    });
    if (isOk(res.status)) return "ok";
    if (PERMANENT_FAILURES.has(res.status)) return "drop";
    // 401 is retried on purpose: the session may be restored by a re-link.
    return "retry";
  } catch {
    return "retry";
  }
}

/**
 * Write-ahead send: the fix is on disk before the network is touched, so a
 * dropped request or a frozen tab can never lose it.
 */
export async function postFix(
  fix: LocationFix,
  box: Outbox = defaultOutbox,
): Promise<DeliveryResult> {
  await box.enqueue(fix);
  const result = await deliver(fix);
  if (result !== "retry") await box.remove([fix.clientId]);
  return result;
}

/**
 * Drain the queue. One request for up to 50 fixes, and single-flight so two
 * wake-up events cannot send the same batch twice.
 */
export async function flushOutbox(
  box: Outbox = defaultOutbox,
): Promise<{ sent: number; kept: number }> {
  if (flushing) return { sent: 0, kept: 0 };
  flushing = true;

  let pending: LocationFix[] = [];
  try {
    pending = await box.list(50);
    if (pending.length === 0) return { sent: 0, kept: 0 };

    if (pending.length === 1) {
      const result = await deliver(pending[0]);
      if (result === "retry") return { sent: 0, kept: 1 };
      await box.remove([pending[0].clientId]);
      return { sent: 1, kept: 0 };
    }

    const res = await fetch("/api/location/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fixes: pending }),
      keepalive: true,
      credentials: "same-origin",
    });

    if (isOk(res.status)) {
      await box.remove(pending.map((f) => f.clientId));
      return { sent: pending.length, kept: 0 };
    }
    if (PERMANENT_FAILURES.has(res.status)) {
      // A malformed batch would never succeed; drop it rather than wedge the
      // queue forever. The individual fixes are still visible to the user as
      // missing, which is honest.
      await box.remove(pending.map((f) => f.clientId));
      return { sent: 0, kept: 0 };
    }
    return { sent: 0, kept: pending.length };
  } catch {
    return { sent: 0, kept: pending.length };
  } finally {
    flushing = false;
  }
}

/**
 * Last-chance send on `pagehide`. A beacon is the only request the browser
 * guarantees to finish after the page is gone.
 */
export function beaconFix(fix: LocationFix): boolean {
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
    return false;
  }
  try {
    // text/plain keeps the beacon a simple request (no preflight it cannot do).
    const blob = new Blob([JSON.stringify(fix)], { type: "text/plain;charset=UTF-8" });
    return navigator.sendBeacon("/api/location", blob);
  } catch {
    return false;
  }
}
