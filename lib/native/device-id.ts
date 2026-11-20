import { newClientId } from "@/lib/location/client-id";

const KEY = "ndj:device-id";

/** Stable, Keychain/Keystore-backed device id used to audit native logins. */
export async function getNativeDeviceId(): Promise<string> {
  const { SecureStoragePlugin } = await import("capacitor-secure-storage-plugin");
  try {
    const { value } = await SecureStoragePlugin.get({ key: KEY });
    if (value) return value;
  } catch {
    // Not stored yet — create it below.
  }
  const value = newClientId();
  await SecureStoragePlugin.set({ key: KEY, value });
  return value;
}
