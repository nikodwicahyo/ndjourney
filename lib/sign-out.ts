import { signOut } from "next-auth/react";
import { unsubscribePush } from "@/lib/push-client";

/**
 * Drop all service-worker caches (private pages/photos included) before the
 * session is torn down. The message is queued even if navigation happens first.
 */
export function clearServiceWorkerCaches() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  const clear = (worker: ServiceWorker | null) => {
    worker?.postMessage({ type: "CLEAR_CACHES" });
  };

  clear(navigator.serviceWorker.controller);
  void navigator.serviceWorker.ready.then((registration) => clear(registration.active)).catch(() => {});
}

export async function signOutAndClear(options?: Parameters<typeof signOut>[0]) {
  clearServiceWorkerCaches();
  // Best-effort and internally bounded: push-client never waits on
  // serviceWorker.ready, so a missing/never-registering worker can't stall sign-out.
  await unsubscribePush();
  return signOut(options);
}
