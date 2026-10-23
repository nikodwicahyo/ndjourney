import { signOut } from "next-auth/react";

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

export function signOutAndClear(options?: Parameters<typeof signOut>[0]) {
  clearServiceWorkerCaches();
  return signOut(options);
}
