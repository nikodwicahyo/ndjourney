// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const installMock = vi.fn(async () => {});

vi.mock("lucide-react", () => ({ Download: () => null }));

import PwaInstallButton from "@/components/native/PwaInstallButton";

type InstallableNavigator = Navigator & { install?: () => Promise<void> };

beforeEach(() => {
  cleanup();
  installMock.mockReset();
  Object.defineProperty(window, "matchMedia", {
    value: () => ({ matches: false }),
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  delete (Navigator.prototype as InstallableNavigator).install;
});

describe("PwaInstallButton", () => {
  it("stays hidden when the browser offers no install path", () => {
    render(<PwaInstallButton />);
    expect(screen.queryByRole("button", { name: /install aplikasi/i })).toBeNull();
  });

  it("calls navigator.install() directly from the click handler", async () => {
    Object.defineProperty(Navigator.prototype, "install", {
      value: installMock,
      configurable: true,
    });
    render(<PwaInstallButton />);

    const button = screen.getByRole("button", { name: /install aplikasi/i });
    fireEvent.click(button);

    expect(installMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/terpasang/i));
  });

  it("uses a captured beforeinstallprompt when navigator.install is unavailable", async () => {
    const prompt = vi.fn(async () => {});
    const userChoice = Promise.resolve({ outcome: "accepted" as const });
    render(<PwaInstallButton />);

    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, { prompt, userChoice });
    window.dispatchEvent(event);

    fireEvent.click(await screen.findByRole("button", { name: /install aplikasi/i }));
    expect(prompt).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/terpasang/i));
  });
});
