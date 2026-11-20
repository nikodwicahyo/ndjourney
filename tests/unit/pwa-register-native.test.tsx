// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

const mocks = vi.hoisted(() => {
  const wb = {
    register: vi.fn(async () => ({})),
    addEventListener: vi.fn(),
    messageSW: vi.fn(),
  };
  return {
    wb,
    ctor: vi.fn(function WorkboxMock() {
      return wb;
    }),
  };
});

vi.mock("workbox-window", () => ({ Workbox: mocks.ctor }));
vi.mock("@/hooks/useAppVersion", () => ({ useAppVersion: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

import PwaRegister from "@/components/PwaRegister";

type CapWindow = Window & { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } };

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "serviceWorker", { value: {}, configurable: true });
  delete (window as CapWindow).Capacitor;
});

afterEach(() => {
  delete (window as CapWindow).Capacitor;
});

describe("PwaRegister native shell", () => {
  it("does not register a service worker inside the Capacitor WebView", () => {
    (window as CapWindow).Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => "android",
    };
    render(<PwaRegister />);
    expect(mocks.ctor).not.toHaveBeenCalled();
    expect(mocks.wb.register).not.toHaveBeenCalled();
  });

  it("still registers on the PWA", () => {
    render(<PwaRegister />);
    expect(mocks.ctor).toHaveBeenCalledWith("/sw.js");
    expect(mocks.wb.register).toHaveBeenCalled();
  });
});
