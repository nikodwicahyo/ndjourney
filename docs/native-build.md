# Native shell (Capacitor) — Android → iOS

Status: Phase 2–3 source is complete. **APK/IPA binaries were not built in this
environment** (no JDK, no Android SDK, no Xcode). Build them on a machine with
the toolchains below.

## How it works

The APK/IPA is a thin WebView shell. It loads the deployed Next.js UI from
`server.url`; there is no duplicate web bundle in the binary. A web deploy is
picked up on the next app launch — only plugin/native changes need a new binary.

- `capacitor.config.ts` → `CAP_SERVER_URL` (defaults to `NEXTAUTH_URL`, then
  `https://ndjourney.vercel.app`).
- `android.useLegacyBridge: true` is **required** by
  `@capacitor-community/background-geolocation`; without it, background updates
  stop after ~5 minutes.
- `cleartext: false`, `allowMixedContent: false`, `allowNavigation: []` — the
  WebView never leaves our origin. Google OAuth is PWA-only.

## Prerequisites

| Platform | Required |
|---|---|
| Android | JDK 21 (required by Capacitor 8), Android SDK platform 36 + build-tools |
| iOS | macOS, Xcode, Apple ID (free = 7-day signing) |

## Build

```bash
# 1. deploy in this order: schema -> server -> web -> native
npm run db:migrate:deploy
npm run build                 # deploy the web build first

# 2. sync native projects (copies config + plugin registries)
npm run native:sync

# Android — signed release APK (local build; set the 4 signing env vars below
# or let Android Studio supply them). Never publish an unsigned APK.
cd android
./gradlew assembleRelease     # Windows: gradlew.bat assembleRelease
# output: android/app/build/outputs/apk/release/app-release.apk

# Local-only debug build — never publish this one (debuggable + public key)
./gradlew assembleDebug

# iOS (macOS only)
cd ../ios/App
open App.xcworkspace          # set team/signing, then Archive in Xcode
```

For LAN development: run `next dev -H 0.0.0.0`, set
`CAP_SERVER_URL=http://<IP-LAN>:3000`, temporarily set `cleartext: true` in
`capacitor.config.ts`, then `npm run native:sync`.

## CI release + distribution (Android)

`.github/workflows/android.yml` builds a **signed release APK** on Ubuntu and
publishes it as a GitHub Release asset. It only runs when native inputs change
(`capacitor.config.ts`, `android/**`, `package*.json`) or on manual dispatch —
web-only pushes never waste an APK build.

1. In **Settings → Secrets and variables → Actions**, add four secrets:

   | Secret | Value |
   |---|---|
   | `ANDROID_RELEASE_KEYSTORE_BASE64` | base64 of the keystore file |
   | `ANDROID_RELEASE_STORE_PASSWORD` | store password |
   | `ANDROID_RELEASE_KEY_ALIAS` | key alias |
   | `ANDROID_RELEASE_KEY_PASSWORD` | key password (use the **store password** for a PKCS12 keystore — see below) |

   Generate the keystore **once** (requires a JDK), then back it up offline —
   losing it means no future APK can upgrade an existing install:

   ```bash
   keytool -genkeypair -v -keystore ndjourney-release.jks -alias ndjourney \
     -storepass '<store-password>' -keypass '<key-password>' \
     -keyalg RSA -keysize 2048 -validity 10000 \
     -dname "CN=NdJourney,O=NdJourney,C=ID"

   # base64 payload for ANDROID_RELEASE_KEYSTORE_BASE64
   base64 -w 0 ndjourney-release.jks   # macOS: base64 -i ndjourney-release.jks | tr -d '\n'
   ```

   With `gh` installed locally you can set all four without printing secrets:

   ```bash
   gh secret set ANDROID_RELEASE_KEYSTORE_BASE64 < base64.txt
   gh secret set ANDROID_RELEASE_STORE_PASSWORD --body '<store-password>'
   gh secret set ANDROID_RELEASE_KEY_ALIAS --body 'ndjourney'
   gh secret set ANDROID_RELEASE_KEY_PASSWORD --body '<store-password>' # PKCS12 (default)
   ```

   JDK 9+ makes `keytool` create **PKCS12** keystores by default, even when the
   file is named `.jks`. PKCS12 does not support a separate key password — the
   key password *is* the store password, so set `ANDROID_RELEASE_KEY_PASSWORD`
   to the same value as `ANDROID_RELEASE_STORE_PASSWORD` (the workflow also
   falls back to this automatically). To keep distinct passwords instead,
   generate with `-storetype JKS`. Verify what you actually have locally:

   ```bash
   keytool -list -v -keystore ndjourney-release.jks -storepass '<store-password>' -alias ndjourney
   ```

   The workflow decodes the keystore into `$RUNNER_TEMP` (never inside the
   checkout, so it cannot be committed or packaged), verifies the store
   password, alias and key password with `keytool` **before** the build, and
   signs via `assembleRelease`. **The job fails fast if any secret is missing or
   the keystore cannot be read** — a broken or unsigned release can never be
   published. `ANDROID_DEBUG_KEYSTORE_BASE64`
   is no longer used.

2. Trigger the workflow manually or push a native change. It runs lint,
   typecheck and tests, then `npx cap sync android` and `assembleRelease`.
3. The release contains `app-release.apk` and `native-version.json`. The stable
   download URL is:

   ```
   https://github.com/nikodwicahyo/ndjourney/releases/latest/download/app-release.apk
   ```

4. **`ANDROID_VERSION_CODE` comes from `github.run_number`**, so builds are
   monotonic. `native-version.json` is read by `GET /api/native/version` and
   drives the in-app **"Versi baru tersedia"** banner. The API validates the
   APK host before returning it, so a tampered manifest cannot turn the update
   button into an open redirect.
5. The workflow derives the APK URL from GitHub's own `$GITHUB_REPOSITORY`, so
   CI needs no config. If the repo is renamed or forked, set
   `NEXT_PUBLIC_NATIVE_GITHUB_REPO` (e.g. `owner/repo`) **in Vercel** so the API
   allowlist and `/get-app` point at the same assets the workflow publishes.
   Leaving the variable unset falls back to `nikodwicahyo/ndjourney`.
6. Release builds are not debuggable and set `android:allowBackup="false"`.
   Keep the keystore private and backed up; if it leaks, rotate to a new key
   with a higher `versionCode` and treat old installs as untrusted.

### User-facing install flow

- Mobile browsers see a small dismissible hint linking to `/get-app` (the
  existing global `InstallPrompt` still offers the standard PWA install path).
- `/get-app` auto-detects the device: Android gets the APK download + 3 install
  steps; iOS gets **Add to Home Screen** instructions (no IPA — Apple blocks
  sideloading without a paid Developer account); desktop gets a copyable link
  **and an explicit "Install aplikasi" button**. That button only appears when
  the browser exposes `navigator.install()` or `beforeinstallprompt`; other
  desktop browsers keep the manual menu instructions. `manifest.json` declares
  a stable `"id": "/"` so the install API can verify app identity.
- Desktop PWA installation is unchanged — Chrome/Edge show the address-bar
  install icon and the global `InstallPrompt` banner still works. To avoid two
  owners racing over the single-use `beforeinstallprompt` event, `InstallPrompt`
  hides itself on `/get-app`, where `PwaInstallButton` is the only listener.
  The service-worker cache was bumped to `v15` so the updated manifest is not
  served from the old precache.
- Existing APKs check for a newer build on launch and on app resume. "Lewati
  versi ini" persists the skipped build; network failures are silent.
- Installing a new APK is still manual. Web deploys need no APK change.

## Login in the app

Google OAuth cannot complete inside the WebView. Flow:

1. On the PWA: **Pengaturan → Hubungkan perangkat → Buat kode perangkat**.
2. A 6-digit code appears for 10 minutes (one-time, 3 attempts).
3. On the phone: open `/native-login`, enter the code.
4. The same NextAuth session cookie is set on the same origin; the global
   location tracker starts on the first authenticated page.

The device id is stored in the OS Keychain/Keystore and recorded against the
used code for audit. Logging out revokes all outstanding codes. A session older
than 3 days needs a fresh link code.

## Permissions shown in **Pengaturan → Izin lokasi di HP**

1. **Izin lokasi** — foreground prompt is automatic; Android 11+ needs
   "Allow all the time" from Settings for background tracking.
2. **Notifikasi** (Android 13+) — the foreground service notification.
3. **Optimasi baterai** — exclude the app so the OS does not pause updates.
4. **Semua izin** — fallback to the app details screen.

If battery exemption is denied, tracking still runs until the OS suspends it;
the partner's UI shows the heartbeat-based status instead of a fake "Live".

## Honest limits

- Swipe-away (Android) / force-quit (iOS) stops tracking; the plugin cannot
  restart itself. The partner sees "aplikasi ditutup" from `lastSeenAt`.
- The free plugin has no native SQLite; fixes taken while the app is truly dead
  cannot be recovered. Fixes taken while alive are in the IndexedDB outbox and
  flush on the next resume/network.
- iOS can suspend WebView JS: fixes queue and post on resume.
- PWA still cannot track while closed — that is an OS limit, not a bug.
- iOS distribution is PWA Add to Home Screen only. A downloadable IPA requires
  the paid Apple Developer program; it is intentionally not part of this setup.

## Verification checklist before shipping a binary

- [ ] `npm run typecheck && npm run lint && npm run test && npm run build`
- [ ] `npm run security:audit` (production deps: 0 vulnerabilities)
- [ ] `apksigner verify --print-certs app-release.apk` shows your release cert
      (not `Android Debug`) and the APK installs over the previous build.
- [ ] Lock screen 10 min while walking → partner sees movement within 60 s.
- [ ] Background 30 min → fixes keep arriving.
- [ ] Battery exemption denied → warning shown, heartbeats continue.
- [ ] Offline 5 min → outbox flushes on reconnect.
- [ ] Swipe-away → partner status degrades within 5 min.
- [ ] Re-link after 3 days idle works with a new code.
