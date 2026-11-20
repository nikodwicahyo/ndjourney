import { describe, expect, it } from "vitest";
import {
  isAllowedApkUrl,
  isNewerBuild,
  normalizeBuild,
  parseRelease,
} from "@/lib/native/version";

const REPO = "nikodwicahyo/ndjourney";
const APK = `https://github.com/${REPO}/releases/latest/download/app-release.apk`;

describe("native version helpers", () => {
  it("normalises only positive safe integers", () => {
    expect(normalizeBuild(42)).toBe(42);
    expect(normalizeBuild("17")).toBe(17);
    for (const bad of [0, -1, 1.5, "x", NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, null]) {
      expect(normalizeBuild(bad)).toBe(0);
    }
  });

  it("prompts only when a known build is behind a newer known build", () => {
    expect(isNewerBuild(12, 13)).toBe(true);
    expect(isNewerBuild(13, 13)).toBe(false);
    expect(isNewerBuild(14, 13)).toBe(false);
    expect(isNewerBuild(0, 13)).toBe(false);
    expect(isNewerBuild(12, "bad")).toBe(false);
  });

  it("allows only our own GitHub Releases APK URL", () => {
    expect(isAllowedApkUrl(APK, REPO)).toBe(true);
    expect(
      isAllowedApkUrl(`https://github.com/${REPO}/releases/download/v1/app-release.apk`, REPO),
    ).toBe(true);
    expect(isAllowedApkUrl("http://github.com/x/releases/a.apk", REPO)).toBe(false);
    expect(isAllowedApkUrl("https://evil.com/x.apk", REPO)).toBe(false);
    expect(isAllowedApkUrl("https://github.com/other/repo/releases/a.apk", REPO)).toBe(false);
    expect(isAllowedApkUrl(`https://github.com/${REPO}/issues/apk`, REPO)).toBe(false);
    expect(isAllowedApkUrl(`https://github.com/${REPO}/releases/latest/download/x.json`, REPO)).toBe(false);
    expect(isAllowedApkUrl("not a url", REPO)).toBe(false);
  });

  it("parses a valid manifest and bounds its strings", () => {
    expect(
      parseRelease(
        { build: 9, version: "0.1.2", apkUrl: APK, releasedAt: "2026-01-01", notes: "fixes" },
        REPO,
      ),
    ).toEqual({
      build: 9,
      version: "0.1.2",
      apkUrl: APK,
      releasedAt: "2026-01-01",
      notes: "fixes",
    });
    expect(
      parseRelease({ build: 9, apkUrl: APK, notes: "x".repeat(500) }, REPO)?.notes?.length,
    ).toBe(300);
  });

  it("rejects malformed or hostile manifests", () => {
    for (const bad of [
      null,
      "string",
      { build: 0, apkUrl: APK },
      { build: 9, apkUrl: "https://evil.com/a.apk" },
      { build: 9 },
    ]) {
      expect(parseRelease(bad, REPO)).toBeNull();
    }
  });
});
