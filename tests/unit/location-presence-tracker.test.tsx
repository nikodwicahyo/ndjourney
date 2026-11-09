// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { initBackgroundLocation } from "@/hooks/useBackgroundLocation";

const geo = vi.hoisted(() => ({
  getCurrentPosition: vi.fn(),
  watchPosition: vi.fn(() => 1),
  clearWatch: vi.fn(),
}));

// The tracker must own the global watcher on every authenticated page, not
// only Home/Location — otherwise a GPS that comes back online while the user
// is on Dashboard never posts and the partner never gets notified.
const state = vi.hoisted(() => ({ sharing: true }));

const { LocationPresenceTracker } = await import(
  "@/components/location/LocationPresenceTracker"
);

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

const reset = () =>
  initBackgroundLocation(false, { invalidateQueries: vi.fn() } as never);

describe("LocationPresenceTracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.sharing = true;
    Object.defineProperty(navigator, "geolocation", {
      value: geo,
      configurable: true,
      writable: true,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ data: { isSharing: state.sharing } }),
      })),
    );
    reset();
  });

  afterEach(() => {
    cleanup();
    reset();
    vi.unstubAllGlobals();
  });

  it("starts the global tracker when the caller is sharing", async () => {
    render(createElement(LocationPresenceTracker), { wrapper });

    await waitFor(() => expect(geo.getCurrentPosition).toHaveBeenCalled());
    expect(geo.watchPosition).toHaveBeenCalled();
  });

  it("does not start when sharing is off", async () => {
    state.sharing = false;
    render(createElement(LocationPresenceTracker), { wrapper });

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await waitFor(() => expect(geo.getCurrentPosition).not.toHaveBeenCalled());
    expect(geo.watchPosition).not.toHaveBeenCalled();
  });

  it("stops the global tracker on unmount", async () => {
    const { unmount } = render(createElement(LocationPresenceTracker), { wrapper });
    await waitFor(() => expect(geo.watchPosition).toHaveBeenCalled());

    unmount();

    expect(geo.clearWatch).toHaveBeenCalled();
  });
});
