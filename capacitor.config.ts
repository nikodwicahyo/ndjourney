import type { CapacitorConfig } from "@capacitor/cli";

// The APK/IPA are thin shells: the UI is always the deployed PWA. A web deploy
// reaches native instantly; only native/plugin changes need a new binary.
const serverUrl =
  process.env.CAP_SERVER_URL ??
  process.env.NEXTAUTH_URL ??
  "https://ndjourney.vercel.app";

const config: CapacitorConfig = {
  appId: "com.ndjourney.app",
  appName: "NDjourney",
  webDir: "public",
  server: {
    url: serverUrl,
    cleartext: false,
    // WebView never leaves our own origin: Google OAuth is PWA-only.
    allowNavigation: [],
  },
  android: {
    backgroundColor: "#0B0B0F",
    allowMixedContent: false,
    // Required by @capacitor-community/background-geolocation: without the
    // legacy bridge, updates stop after ~5 minutes in the background.
    useLegacyBridge: true,
  },
  ios: {
    contentInset: "always",
  },
};

export default config;
