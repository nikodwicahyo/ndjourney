// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { APK_URL } from "@/lib/native/version";

const mocks = vi.hoisted(() => ({
  platform: "android" as string | null,
  installed: 10,
  assign: vi.fn(),
}));

vi.mock("@/lib/location/platform", () => ({
  getNativePlatform: () => mocks.platform,
  isNativePlatform: () => mocks.platform !== null,
}));

vi.mock("@/lib/native/app-info", () => ({
  getInstalledBuild: async () => mocks.installed,
  onNativeResume: async () => () => {},
}));

vi.mock("@/lib/native/open-apk", () => ({
  openExternalUrl: (url: string) => mocks.assign(url),
}));

vi.mock("lucide-react", () => ({
  Download: () => null,
  X: () => null,
  Smartphone: () => null,
  Apple: () => null,
  Check: () => null,
  Copy: () => null,
}));

import NativeUpdateBanner from "@/components/native/NativeUpdateBanner";
import SmartInstallBanner from "@/components/native/SmartInstallBanner";
import GetAppContent from "@/components/native/GetAppContent";

const manifest = {
  build: 12,
  version: "1.0.12",
  apkUrl: APK_URL,
  releasedAt: "2026-11-20T12:00:00Z",
};

function mockFetch(build = manifest.build) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { ...manifest, build } }),
    })),
  );
}

function setUserAgent(value: string) {
  Object.defineProperty(navigator, "userAgent", { value, configurable: true });
}

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
  mocks.platform = "android";
  mocks.installed = 10;
  window.localStorage.clear();
  Object.defineProperty(window, "matchMedia", {
    value: () => ({ matches: false }),
    configurable: true,
  });
  setUserAgent("Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("NativeUpdateBanner", () => {
  it("shows when the installed build is behind the published build", async () => {
    mockFetch();
    render(<NativeUpdateBanner />);

    expect(await screen.findByText(/versi baru tersedia/i)).toBeTruthy();
    expect(screen.getByText(/build 12 sudah dirilis/i)).toBeTruthy();
  });

  it("navigates to the validated APK so the WebView launches the OS installer", async () => {
    mockFetch();
    render(<NativeUpdateBanner />);
    fireEvent.click(await screen.findByRole("button", { name: /unduh & perbarui/i }));

    expect(mocks.assign).toHaveBeenCalledWith(APK_URL);
  });

  it("stays hidden on the same build and on iOS", async () => {
    mockFetch(10);
    const { unmount } = render(<NativeUpdateBanner />);
    await waitFor(() => expect(screen.queryByText(/versi baru tersedia/i)).toBeNull());

    unmount();
    mocks.platform = "ios";
    mockFetch(99);
    render(<NativeUpdateBanner />);
    await waitFor(() => expect(screen.queryByText(/versi baru tersedia/i)).toBeNull());
  });

  it("remembers a skipped build", async () => {
    mockFetch();
    render(<NativeUpdateBanner />);
    fireEvent.click(await screen.findByRole("button", { name: /lewati versi ini/i }));

    expect(screen.queryByText(/versi baru tersedia/i)).toBeNull();
    expect(window.localStorage.getItem("native-update-skipped-build")).toBe("12");

    cleanup();
    render(<NativeUpdateBanner />);
    await waitFor(() => expect(screen.queryByText(/versi baru tersedia/i)).toBeNull());
  });
});

describe("SmartInstallBanner", () => {
  it("hints Android users and links to the install guide", () => {
    mocks.platform = null;
    render(<SmartInstallBanner />);

    expect(screen.getByText(/pasang aplikasi ndjourney/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /caranya/i }).getAttribute("href")).toBe("/get-app");
  });

  it("leaves iOS to the existing global InstallPrompt", () => {
    mocks.platform = null;
    setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1");
    render(<SmartInstallBanner />);

    expect(screen.queryByText(/tambahkan ndjourney ke layar utama/i)).toBeNull();
  });

  it("stays hidden in the native app and in an installed PWA", () => {
    render(<SmartInstallBanner />);
    expect(screen.queryByText(/pasang aplikasi ndjourney/i)).toBeNull();

    mocks.platform = null;
    Object.defineProperty(window, "matchMedia", {
      value: () => ({ matches: true }),
      configurable: true,
    });
    cleanup();
    render(<SmartInstallBanner />);
    expect(screen.queryByText(/pasang aplikasi ndjourney/i)).toBeNull();
  });

  it("stays dismissed after the user closes it", () => {
    mocks.platform = null;
    const { unmount } = render(<SmartInstallBanner />);
    fireEvent.click(screen.getByRole("button", { name: /tutup petunjuk pemasangan/i }));
    unmount();

    render(<SmartInstallBanner />);
    expect(screen.queryByText(/pasang aplikasi ndjourney/i)).toBeNull();
  });
});

describe("GetAppContent platform detection", () => {
  it("shows the APK path to an Android user who installed the PWA", () => {
    mocks.platform = null;
    Object.defineProperty(window, "matchMedia", {
      value: () => ({ matches: true }),
      configurable: true,
    });
    render(<GetAppContent />);

    expect(screen.getByRole("link", { name: /unduh apk/i }).getAttribute("href")).toBe(APK_URL);
    expect(screen.queryByText(/tambahkan ke layar utama/i)).toBeNull();
  });

  it("keeps Add to Home Screen for an installed iOS PWA", () => {
    mocks.platform = null;
    setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1");
    Object.defineProperty(window, "matchMedia", {
      value: () => ({ matches: true }),
      configurable: true,
    });
    render(<GetAppContent />);

    expect(screen.getByText(/tambahkan ke layar utama/i)).toBeTruthy();
  });
});
