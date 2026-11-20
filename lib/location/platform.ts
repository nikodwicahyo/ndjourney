/**
 * Native detection without importing @capacitor/core into every web chunk.
 * Capacitor injects `window.Capacitor` with these helpers in v8; the optional
 * chaining keeps this SSR-safe and false on the PWA.
 */
export type NativePlatform = "android" | "ios";

type CapacitorWindow = Window & {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    getPlatform?: () => string;
  };
};

export function getNativePlatform(): NativePlatform | null {
  if (typeof window === "undefined") return null;
  const cap = (window as CapacitorWindow).Capacitor;
  const platform = cap?.getPlatform?.();
  if (platform === "android" || platform === "ios") return platform;
  if (cap?.isNativePlatform?.() !== true) return null;
  // Bridge globals are a fallback for older Capacitor runtimes.
  if ((window as { androidBridge?: unknown }).androidBridge) return "android";
  if ((window as { webkit?: { messageHandlers?: { bridge?: unknown } } }).webkit?.messageHandlers?.bridge) {
    return "ios";
  }
  return null;
}

export function isNativePlatform(): boolean {
  return getNativePlatform() !== null;
}
