// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ path: "/" }));

vi.mock("next/navigation", () => ({ usePathname: () => mocks.path }));
vi.mock("lucide-react", () => ({
  X: () => null,
  Heart: () => null,
  Download: () => null,
  Share2: () => null,
  Smartphone: () => null,
  Monitor: () => null,
  Globe: () => null,
}));

import InstallPrompt from "@/components/InstallPrompt";

beforeEach(() => {
  cleanup();
  mocks.path = "/";
  window.localStorage.clear();
  Object.defineProperty(window, "matchMedia", {
    value: () => ({ matches: false }),
    configurable: true,
  });
});

afterEach(() => cleanup());

describe("InstallPrompt on the dedicated install page", () => {
  it("hides on /get-app so PwaInstallButton owns beforeinstallprompt", async () => {
    const { container, rerender } = render(<InstallPrompt />);
    await waitFor(() => expect(container.innerHTML).not.toBe(""));

    mocks.path = "/get-app";
    rerender(<InstallPrompt />);
    expect(container.innerHTML).toBe("");
  });

  it("keeps working on other pages", async () => {
    mocks.path = "/";
    const { container } = render(<InstallPrompt />);
    await waitFor(() => expect(container.innerHTML).not.toBe(""));
  });
});
