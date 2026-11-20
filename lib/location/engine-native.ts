import type { BackgroundGeolocationPlugin } from "@capacitor-community/background-geolocation";
import { getNativePlatform } from "./platform";
import { toLocationFix } from "./native-fix";
import { flushOutbox } from "./sender";
import type { LocationFix, TrackingState } from "./types";

export type NativeEngineCallbacks = {
  onFix: (fix: LocationFix) => void;
  onState: (state: TrackingState | "gps-error") => void;
};

let bg: BackgroundGeolocationPlugin | null = null;
let watcherId: string | null = null;
let removeAppListener: (() => Promise<void>) | null = null;
let removeOnline: (() => void) | null = null;

async function getPlugin(): Promise<BackgroundGeolocationPlugin> {
  if (!bg) {
    // Dynamic: the native bridge does not exist in the PWA bundle.
    const { registerPlugin } = await import("@capacitor/core");
    bg = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");
  }
  return bg;
}

/**
 * Start the OS-level watcher. It keeps delivering fixes while the WebView is
 * backgrounded (Android foreground service / iOS background mode), which a
 * service worker can never do.
 */
export async function startNativeEngine(cb: NativeEngineCallbacks): Promise<void> {
  if (watcherId) return;

  const [plugin, { App }] = await Promise.all([
    getPlugin(),
    import("@capacitor/app"),
  ]);

  let active = (await App.getState()).isActive;
  cb.onState(active ? "foreground" : "background");

  watcherId = await plugin.addWatcher(
    {
      backgroundTitle: "NDjourney berbagi lokasi",
      backgroundMessage: "Ketuk untuk membuka aplikasi.",
      requestPermissions: true,
      stale: false,
      // The web engine already gates posts by movement; this saves battery
      // and keeps the outbox small on a stationary device.
      distanceFilter: 10,
    },
    (position, error) => {
      if (error) {
        cb.onState(error.code === "NOT_AUTHORIZED" ? "denied" : "gps-error");
        return;
      }
      const fix = toLocationFix(position, { isActive: active });
      if (fix) cb.onFix(fix);
    },
  );

  const handle = await App.addListener("appStateChange", ({ isActive }) => {
    active = isActive;
    cb.onState(isActive ? "foreground" : "background");
    if (isActive) void flushOutbox();
  });
  removeAppListener = () => handle.remove();

  const online = () => void flushOutbox();
  window.addEventListener("online", online);
  removeOnline = () => window.removeEventListener("online", online);
}

/** Stop the OS watcher and every listener it installed. Idempotent. */
export async function stopNativeEngine(): Promise<void> {
  if (watcherId && bg) {
    const id = watcherId;
    watcherId = null;
    await bg.removeWatcher({ id }).catch(() => {});
  }
  if (removeAppListener) {
    const remove = removeAppListener;
    removeAppListener = null;
    await remove().catch(() => {});
  }
  removeOnline?.();
  removeOnline = null;
}

export type NativeSetting = "location" | "app" | "battery" | "notifications";

/** Open the exact OS screen needed for a permission the OS cannot re-prompt. */
export async function openNativeSetting(setting: NativeSetting): Promise<void> {
  const { NativeSettings, AndroidSettings, IOSSettings } = await import(
    "capacitor-native-settings"
  );
  switch (setting) {
    case "location":
      if (getNativePlatform() === "ios") {
        // Apple only officially allows opening your own app's settings; that
        // is also where the per-app "Always" location permission lives. The
        // general LocationServices screen cannot grant it.
        await NativeSettings.openIOS({ option: IOSSettings.App });
      } else {
        await NativeSettings.openAndroid({ option: AndroidSettings.Location });
      }
      return;
    case "battery":
      await NativeSettings.openAndroid({ option: AndroidSettings.BatteryOptimization });
      return;
    case "notifications":
      if (getNativePlatform() === "ios") {
        await NativeSettings.openIOS({ option: IOSSettings.AppNotification });
      } else {
        await NativeSettings.openAndroid({ option: AndroidSettings.AppNotification });
      }
      return;
    case "app":
      await NativeSettings.open({
        optionAndroid: AndroidSettings.ApplicationDetails,
        optionIOS: IOSSettings.App,
      });
  }
}
