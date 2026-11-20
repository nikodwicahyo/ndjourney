/**
 * Native update manifest: pure parsing/comparison helpers shared by the API
 * route (server validation) and the in-app banner (client decision).
 */

// Public repo slug — safe to ship in the client bundle. NEXT_PUBLIC_ keeps the
// API route and the /get-app page pointing at the same release assets.
export const NATIVE_REPO = process.env.NEXT_PUBLIC_NATIVE_GITHUB_REPO || "nikodwicahyo/ndjourney";
export const APK_URL = `https://github.com/${NATIVE_REPO}/releases/latest/download/app-release.apk`;
export const MANIFEST_URL = `https://github.com/${NATIVE_REPO}/releases/latest/download/native-version.json`;

export type NativeRelease = {
  build: number;
  version: string;
  apkUrl: string;
  releasedAt: string;
  notes?: string;
};

/** Android versionCode is a positive integer; anything else is "unknown". */
export function normalizeBuild(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

export function isNewerBuild(installed: unknown, latest: unknown): boolean {
  const have = normalizeBuild(installed);
  const want = normalizeBuild(latest);
  // An unknown installed build must not trigger an update prompt.
  return have > 0 && want > 0 && want > have;
}

/**
 * Never render an arbitrary URL as the "install update" target. Only our own
 * GitHub Releases APK asset is allowed — a tampered manifest cannot turn the
 * update button into an open redirect or a malware download.
 */
export function isAllowedApkUrl(url: unknown, repo: string): url is string {
  if (typeof url !== "string" || !url.startsWith("https://")) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.hostname.toLowerCase() !== "github.com") return false;
  const prefix = `/${repo}/releases/`;
  return parsed.pathname.startsWith(prefix) && parsed.pathname.toLowerCase().endsWith(".apk");
}

/** Validate and bound an untrusted release manifest. Null = ignore it. */
export function parseRelease(value: unknown, repo: string): NativeRelease | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const build = normalizeBuild(v.build);
  if (!build || !isAllowedApkUrl(v.apkUrl, repo)) return null;

  return {
    build,
    version: typeof v.version === "string" ? v.version.slice(0, 40) : "",
    apkUrl: v.apkUrl,
    releasedAt: typeof v.releasedAt === "string" ? v.releasedAt.slice(0, 40) : "",
    ...(typeof v.notes === "string" && v.notes.trim() ? { notes: v.notes.slice(0, 300) } : {}),
  };
}
