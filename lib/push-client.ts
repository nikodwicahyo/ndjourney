export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * iPhone/iPod always report their own UA, but iPadOS 13+ ships a desktop
 * "MacIntel" UA. Match the same predicate `components/InstallPrompt.tsx` uses.
 */
function isIOS(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  const platform = (navigator.platform || "").toLowerCase();
  return (
    /iphone|ipad|ipod/.test(ua) ||
    (platform === "macintel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  if ((navigator as unknown as { standalone?: boolean }).standalone === true) return true;
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches
  );
}

export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  if (!("PushManager" in window)) return false;
  if (!("Notification" in window)) return false;
  // iOS Safari only allows web push once the app is on the home screen.
  if (isIOS() && !isStandalone()) return false;
  return true;
}

export type PushState = "unsupported" | "default" | "granted" | "denied" | "a2hs-required";

export function getPushState(): PushState {
  if (typeof window === "undefined") return "unsupported";
  if (isIOS() && !isStandalone()) return "a2hs-required";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  const perm = Notification.permission;
  if (perm === "granted") return "granted";
  if (perm === "denied") return "denied";
  return "default";
}

/**
 * The active registration, if the page already has one. `serviceWorker.ready`
 * never rejects — it just never settles when no worker registers — so every
 * caller must be able to bail out instead of waiting on it forever.
 */
async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;
    // Registration may still be in flight on first load / slow devices.
    // Wait briefly, but never hang on a worker that never registers.
    return await Promise.race([
      navigator.serviceWorker.ready.then((r) => r ?? null).catch(() => null),
      new Promise<ServiceWorkerRegistration | null>((resolve) =>
        setTimeout(() => resolve(null), 2000),
      ),
    ]);
  } catch (error) {
    console.warn("[push] service worker lookup failed:", error);
    return null;
  }
}

export async function subscribePush(): Promise<boolean> {
  try {
    if (!isPushSupported()) return false;

    // Denied can never be re-prompted from JS — fail before any SW work.
    if (Notification.permission === "denied") {
      console.warn("[push] notifikasi diblokir di pengaturan browser");
      return false;
    }
    if (Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.warn("[push] izin notifikasi tidak diberikan");
        return false;
      }
    }

    // Read at call time: a missing build-time env must not crash the module.
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      console.warn("[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY belum diset");
      return false;
    }

    const registration = await getServiceWorkerRegistration();
    if (!registration) {
      console.warn("[push] service worker belum terdaftar");
      return false;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
    const json = subscription.toJSON();
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    });
    if (!res.ok) {
      console.warn("[push] gagal menyimpan langganan:", res.status);
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[push] gagal mengaktifkan notifikasi:", error);
    return false;
  }
}

/** Best-effort: sign-out calls this, so it must never throw or hang. */
export async function unsubscribePush(): Promise<void> {
  try {
    const registration = await getServiceWorkerRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;

    const { endpoint } = subscription;
    await subscription.unsubscribe();
    const res = await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
      // Sign-out awaits this — bound the request so a stalled socket can't block it.
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) console.warn("[push] gagal menghapus langganan:", res.status);
  } catch (error) {
    console.warn("[push] gagal menonaktifkan notifikasi:", error);
  }
}

/** Whether this device currently holds a push subscription (permission alone can't tell). */
export async function isPushSubscribed(): Promise<boolean> {
  try {
    const registration = await getServiceWorkerRegistration();
    return Boolean(await registration?.pushManager.getSubscription());
  } catch (error) {
    console.warn("[push] gagal memeriksa langganan:", error);
    return false;
  }
}
