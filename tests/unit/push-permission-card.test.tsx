// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

const push = vi.hoisted(() => ({
  getPushState: vi.fn(),
  subscribePush: vi.fn(),
}));

vi.mock("@/lib/push-client", () => push);

const { default: PushPermissionCard } = await import(
  "@/components/notifications/PushPermissionCard"
);

const DISMISS_KEY = "push-card-dismissed-v1";

beforeEach(() => {
  localStorage.clear();
  push.getPushState.mockReset().mockReturnValue("default");
  push.subscribePush.mockReset().mockResolvedValue(true);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("PushPermissionCard", () => {
  it("renders Indonesian copy while permission is still default", async () => {
    render(<PushPermissionCard />);

    expect(await screen.findByText("Aktifkan notifikasi")).toBeTruthy();
    expect(screen.getByText(/kabar baru dari pasanganmu/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Aktifkan" })).toBeTruthy();
  });

  it("calls subscribePush on confirm and disappears once granted", async () => {
    render(<PushPermissionCard />);

    const confirm = await screen.findByRole("button", { name: "Aktifkan" });
    push.getPushState.mockReturnValue("granted");
    fireEvent.click(confirm);
    await waitFor(() => expect(push.subscribePush).toHaveBeenCalledTimes(1));

    await waitFor(() => expect(screen.queryByText("Aktifkan notifikasi")).toBeNull());
  });

  it("stays visible with a retry hint when subscribing fails", async () => {
    push.subscribePush.mockResolvedValue(false);

    render(<PushPermissionCard />);
    fireEvent.click(await screen.findByRole("button", { name: "Aktifkan" }));

    expect(await screen.findByText(/Gagal mengaktifkan notifikasi/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Aktifkan" })).toBeTruthy();
  });

  it("stores the dismiss flag and hides the card", async () => {
    render(<PushPermissionCard />);

    fireEvent.click(await screen.findByRole("button", { name: "Nanti saja" }));

    expect(localStorage.getItem(DISMISS_KEY)).toBe("1");
    expect(screen.queryByText("Aktifkan notifikasi")).toBeNull();
  });

  it("stays hidden when the dismiss flag is already stored", async () => {
    localStorage.setItem(DISMISS_KEY, "1");

    render(<PushPermissionCard />);

    await waitFor(() => expect(push.getPushState).not.toHaveBeenCalled());
    expect(screen.queryByText("Aktifkan notifikasi")).toBeNull();
  });

  it("explains Add to Home Screen on iOS instead of prompting", async () => {
    push.getPushState.mockReturnValue("a2hs-required");

    render(<PushPermissionCard />);

    expect(
      await screen.findByText(/Layar Utama \(Add to Home Screen\)/i),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Aktifkan" })).toBeNull();
  });

  it("renders nothing for granted, denied or unsupported devices", async () => {
    for (const state of ["granted", "denied", "unsupported"] as const) {
      push.getPushState.mockReturnValue(state);
      const { unmount } = render(<PushPermissionCard />);
      await waitFor(() => expect(push.getPushState).toHaveBeenCalled());
      expect(document.body.textContent).toBe("");
      unmount();
      push.getPushState.mockClear();
    }
  });
});
