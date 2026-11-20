import { getNativePlatform } from "@/lib/location/platform";
import { normalizeBuild } from "@/lib/native/version";

/** Installed APK versionCode. Zero on web/PWA or when the bridge is unavailable. */
export async function getInstalledBuild(): Promise<number> {
  if (getNativePlatform() !== "android") return 0;
  try {
    // Dynamic import keeps Capacitor runtime code out of the web bundle.
    const { App } = await import("@capacitor/app");
    const info = await App.getInfo();
    return normalizeBuild(info.build);
  } catch {
    return 0;
  }
}

/** Re-check after the OS resumes the app (a new APK may have been installed). */
export async function onNativeResume(callback: () => void): Promise<() => void> {
  if (getNativePlatform() !== "android") return () => {};
  try {
    const { App } = await import("@capacitor/app");
    const handle = await App.addListener("resume", callback);
    return () => void handle.remove();
  } catch {
    return () => {};
  }
}
