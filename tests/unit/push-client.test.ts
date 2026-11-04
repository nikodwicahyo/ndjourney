// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi, type MockInstance } from "vitest";
import {
  urlBase64ToUint8Array,
  isPushSupported,
  getPushState,
  subscribePush,
  unsubscribePush,
  isPushSubscribed,
} from "@/lib/push-client";

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

// Well-known web-push sample VAPID public key: 65-byte uncompressed P-256 point.
const VAPID_KEY =
  "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";
const ENDPOINT = "https://push.example.com/sub/abc";

type ServerKeys = { p256dh: string; auth: string };

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
}

function setStandalone(value: boolean) {
  Object.defineProperty(window.navigator, "standalone", { value, configurable: true });
}

function removeNavigatorProp(name: string) {
  delete (window.navigator as unknown as Record<string, unknown>)[name];
}

function removeWindowProp(name: string) {
  delete (window as unknown as Record<string, unknown>)[name];
}

type SupportOptions = {
  permission?: NotificationPermission;
  registered?: boolean;
  readyHangs?: boolean;
};

function installSupport({
  permission = "granted",
  registered = true,
  readyHangs = false,
}: SupportOptions = {}) {
  const keys: ServerKeys = { p256dh: "p256dh-key", auth: "auth-key" };
  const subscription = {
    endpoint: ENDPOINT,
    toJSON: () => ({ endpoint: ENDPOINT, keys }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
  const subscribe = vi.fn().mockResolvedValue(subscription);
  const getSubscription = vi.fn().mockResolvedValue(subscription);
  const registration = { pushManager: { subscribe, getSubscription } };
  const getRegistration = vi.fn().mockResolvedValue(registered ? registration : undefined);

  vi.stubGlobal("PushManager", function PushManager() {});
  vi.stubGlobal("Notification", {
    permission,
    requestPermission: vi.fn().mockResolvedValue("granted"),
  });
  Object.defineProperty(window.navigator, "serviceWorker", {
    configurable: true,
    value: {
      getRegistration,
      // Deliberately hanging `ready`: production browsers never reject it.
      ready: readyHangs ? new Promise(() => {}) : Promise.resolve(registration),
    },
  });

  return { registration, subscribe, getSubscription, subscription, getRegistration };
}

function stubFetch(response: { ok: boolean; status?: number } = { ok: true }) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

let warnSpy: MockInstance;

beforeEach(() => {
  setUserAgent(DESKTOP_UA);
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  removeNavigatorProp("serviceWorker");
  removeNavigatorProp("standalone");
  removeWindowProp("PushManager");
  removeWindowProp("Notification");
  setUserAgent(DESKTOP_UA);
  delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
});

describe("urlBase64ToUint8Array", () => {
  it("decodes base64url byte for byte", () => {
    expect(Array.from(urlBase64ToUint8Array("AQAB"))).toEqual([1, 0, 1]);
    // "_" and "-" are the URL-safe alphabet and need the +/ translation.
    expect(Array.from(urlBase64ToUint8Array("_-8"))).toEqual([255, 239]);

    const bytes = urlBase64ToUint8Array(VAPID_KEY);
    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(0x04);
    expect(Array.from(bytes)).toEqual(Array.from(Buffer.from(VAPID_KEY, "base64url")));
  });
});

describe("isPushSupported / getPushState", () => {
  it("is unsupported without a service worker or PushManager", () => {
    expect(isPushSupported()).toBe(false);
    expect(getPushState()).toBe("unsupported");
  });

  it("is unsupported without the Notification API", () => {
    installSupport();
    removeWindowProp("Notification");

    expect(getPushState()).toBe("unsupported");
  });

  it("maps Notification.permission to default/granted/denied", () => {
    for (const permission of ["default", "granted", "denied"] as const) {
      installSupport({ permission });
      expect(getPushState()).toBe(permission);
    }
  });

  it("asks for Add to Home Screen on iOS Safari outside standalone mode", () => {
    setUserAgent(IOS_UA);
    installSupport();

    expect(isPushSupported()).toBe(false);
    expect(getPushState()).toBe("a2hs-required");
  });

  it("reports the real permission on iOS once installed", () => {
    setUserAgent(IOS_UA);
    setStandalone(true);
    installSupport({ permission: "granted" });

    expect(isPushSupported()).toBe(true);
    expect(getPushState()).toBe("granted");
  });
});

describe("subscribePush", () => {
  it("subscribes and posts the subscription JSON to /api/push/subscribe", async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = VAPID_KEY;
    const env = installSupport({ permission: "default" });
    const fetchMock = stubFetch();

    await expect(subscribePush()).resolves.toBe(true);

    expect(env.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/push/subscribe");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      endpoint: ENDPOINT,
      keys: { p256dh: "p256dh-key", auth: "auth-key" },
    });
  });

  it("returns false when permission is denied, without touching the service worker", async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = VAPID_KEY;
    const env = installSupport({ permission: "denied", readyHangs: true });
    const fetchMock = stubFetch();

    await expect(subscribePush()).resolves.toBe(false);

    expect(env.getRegistration).not.toHaveBeenCalled();
    expect(env.subscribe).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns false when the user dismisses the permission prompt", async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = VAPID_KEY;
    const env = installSupport({ permission: "default" });
    (Notification.requestPermission as unknown as MockInstance).mockResolvedValue("denied");
    const fetchMock = stubFetch();

    await expect(subscribePush()).resolves.toBe(false);

    expect(env.subscribe).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns false when the VAPID public key is not configured", async () => {
    const env = installSupport({ permission: "granted" });
    const fetchMock = stubFetch();

    await expect(subscribePush()).resolves.toBe(false);

    expect(env.subscribe).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns false when the service worker is not registered", async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = VAPID_KEY;
    const env = installSupport({ permission: "granted", registered: false });
    const fetchMock = stubFetch();

    await expect(subscribePush()).resolves.toBe(false);

    expect(env.subscribe).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns false and logs when the API rejects the subscription", async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = VAPID_KEY;
    installSupport({ permission: "granted" });
    stubFetch({ ok: false, status: 500 });

    await expect(subscribePush()).resolves.toBe(false);

    expect(warnSpy).toHaveBeenCalled();
  });

  it("returns false and logs instead of throwing when subscribing crashes", async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = VAPID_KEY;
    const env = installSupport({ permission: "granted" });
    env.subscribe.mockRejectedValueOnce(new Error("boom"));
    stubFetch();

    await expect(subscribePush()).resolves.toBe(false);

    expect(warnSpy).toHaveBeenCalled();
  });
});

describe("unsubscribePush", () => {
  it("unsubscribes locally and posts the endpoint to /api/push/unsubscribe", async () => {
    const env = installSupport();
    const fetchMock = stubFetch();

    await expect(unsubscribePush()).resolves.toBeUndefined();

    expect(env.subscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/push/unsubscribe");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ endpoint: ENDPOINT });
  });

  // Sign-out calls this and must never hang on serviceWorker.ready.
  it("settles even when serviceWorker.ready never resolves", async () => {
    installSupport({ readyHangs: true });
    stubFetch();

    const outcome = await Promise.race([
      unsubscribePush().then(() => "settled"),
      new Promise((resolve) => setTimeout(() => resolve("hung"), 100)),
    ]);

    expect(outcome).toBe("settled");
  });

  it("never throws when the service worker lookup rejects", async () => {
    const env = installSupport();
    env.getRegistration.mockRejectedValueOnce(new Error("no sw"));
    stubFetch();

    await expect(unsubscribePush()).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalled();
  });

  it("does nothing when there is no registration", async () => {
    installSupport({ registered: false });
    const fetchMock = stubFetch();

    await expect(unsubscribePush()).resolves.toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("isPushSubscribed", () => {
  it("reports an existing subscription", async () => {
    installSupport();

    await expect(isPushSubscribed()).resolves.toBe(true);
  });

  it("reports false when nothing is subscribed", async () => {
    const env = installSupport();
    env.getSubscription.mockResolvedValueOnce(null);

    await expect(isPushSubscribed()).resolves.toBe(false);
  });

  it("reports false without a registration or on error", async () => {
    installSupport({ registered: false });
    await expect(isPushSubscribed()).resolves.toBe(false);

    const env = installSupport();
    env.getRegistration.mockRejectedValueOnce(new Error("no sw"));
    await expect(isPushSubscribed()).resolves.toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });
});
