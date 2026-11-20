// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  initBackgroundLocation,
  retrySharing,
  useBackgroundLocationStatus,
} from "@/hooks/useBackgroundLocation";

type GeoCb = {
  success: PositionCallback;
  error: PositionErrorCallback;
};

const TIMEOUT_ERR = {
  code: 3,
  message: "timeout",
  PERMISSION_DENIED: 1,
  POSITION_UNAVAILABLE: 2,
  TIMEOUT: 3,
} as unknown as GeolocationPositionError;

const DENIED_ERR = { ...TIMEOUT_ERR, code: 1 } as unknown as GeolocationPositionError;

function position(accuracy = 10, latitude = -6.2, longitude = 106.8): GeolocationPosition {
  return {
    coords: {
      latitude,
      longitude,
      accuracy,
      heading: null,
      speed: null,
      altitude: null,
      altitudeAccuracy: null,
      toJSON: () => ({}),
    },
    timestamp: Date.now(),
    toJSON: () => ({}),
  } as unknown as GeolocationPosition;
}

const geoMock = vi.hoisted(() => ({
  gets: [] as GeoCb[],
  watch: null as GeoCb | null,
  getCurrentPosition: vi.fn(),
  watchPosition: vi.fn(),
  clearWatch: vi.fn(),
}));

const qc = { invalidateQueries: vi.fn() } as never;

function fireTimeout() {
  const cb = geoMock.gets.shift();
  cb?.error(TIMEOUT_ERR);
}

// Each GPS_PING_INTERVAL elapses → a ping was queued → fail it.
async function advanceAndFailPing() {
  await act(async () => { await vi.advanceTimersByTimeAsync(12_000); });
  act(() => fireTimeout());
}

// Stuck-"recovering" regression: GPS timeouts with no payload must escalate
// to an actionable gps-error (with retry) instead of spinning forever while
// POSTs stay green. Desktop browsers without GPS hardware hit exactly this.
describe("background location GPS failure escalation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    geoMock.gets = [];
    geoMock.watch = null;
    geoMock.getCurrentPosition.mockImplementation((s: PositionCallback, e?: PositionErrorCallback) => {
      geoMock.gets.push({ success: s, error: e ?? (() => {}) });
    });
    geoMock.watchPosition.mockImplementation((s: PositionCallback, e?: PositionErrorCallback) => {
      geoMock.watch = { success: s, error: e ?? (() => {}) };
      return 1;
    });
    Object.defineProperty(navigator, "geolocation", {
      value: geoMock,
      configurable: true,
      writable: true,
    });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200 }) as Response));
    initBackgroundLocation(false, qc); // reset module-global state
  });

  afterEach(() => {
    initBackgroundLocation(false, qc);
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function subscribe() {
    return renderHook(() => useBackgroundLocationStatus());
  }

  it("escalates recovering → gps-error after 3 consecutive GPS timeouts", async () => {
    const { result } = subscribe();
    act(() => initBackgroundLocation(true, qc));
    expect(result.current).toBe("locating");

    act(() => fireTimeout()); // initial fix attempt
    expect(result.current).toBe("recovering");

    await advanceAndFailPing(); // ping 1 → streak 2
    expect(result.current).toBe("recovering");

    await advanceAndFailPing(); // ping 2 → streak 3
    expect(result.current).toBe("gps-error");
  });

  it("a live fix clears gps-error back to sharing", async () => {
    const { result } = subscribe();
    act(() => initBackgroundLocation(true, qc));
    act(() => fireTimeout());
    await advanceAndFailPing();
    await advanceAndFailPing();
    expect(result.current).toBe("gps-error");

    act(() => geoMock.watch?.success(position(10)));
    expect(result.current).toBe("sharing");
  });

  it("retrySharing resets the streak and acquires immediately", async () => {
    const { result } = subscribe();
    act(() => initBackgroundLocation(true, qc));
    act(() => fireTimeout());
    await advanceAndFailPing();
    await advanceAndFailPing();
    expect(result.current).toBe("gps-error");

    const calls = geoMock.getCurrentPosition.mock.calls.length;
    act(() => retrySharing(qc));
    expect(result.current).toBe("locating");
    expect(geoMock.getCurrentPosition.mock.calls.length).toBe(calls + 1);

    // …and the streak restarts from zero, not from the old count.
    act(() => fireTimeout());
    expect(result.current).toBe("recovering");
  });

  it("permission denial stays denied (never escalates)", async () => {
    const { result } = subscribe();
    act(() => initBackgroundLocation(true, qc));
    act(() => geoMock.gets.shift()?.error(DENIED_ERR));
    expect(result.current).toBe("denied");
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(result.current).toBe("denied");
  });

  it("posts on movement even when GPS accuracy is unchanged", async () => {
    // Regression: the old accuracy-only gate froze the position of a walking
    // phone, because accuracy rarely improves while moving.
    act(() => initBackgroundLocation(true, qc));
    geoMock.gets.shift(); // initial fix attempt, not under test

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    act(() => geoMock.watch?.success(position(10)));
    await act(async () => {});
    fetchMock.mockClear();

    await act(async () => { await vi.advanceTimersByTimeAsync(9_000); });
    act(() => geoMock.watch?.success(position(10, -6.20005))); // ~5.6 m north
    await act(async () => {});

    const posted = fetchMock.mock.calls.find((c) => c[0] === "/api/location");
    expect(posted).toBeTruthy();
    const body = JSON.parse(String((posted?.[1] as RequestInit).body));
    expect(body.latitude).toBeCloseTo(-6.20005, 6);
  });

  it("sends a coordinate-free heartbeat instead of re-posting the last fix", async () => {
    // Regression: keepAlive re-posted the previous payload, refreshing
    // updatedAt while the coordinates were stale — the UI then said "Live" at
    // an old spot.
    act(() => initBackgroundLocation(true, qc));
    geoMock.gets.shift();

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    act(() => geoMock.watch?.success(position(10)));
    await act(async () => {});
    fetchMock.mockClear();

    await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });

    const posts = fetchMock.mock.calls.filter((c) => c[0] === "/api/location");
    const beats = fetchMock.mock.calls.filter((c) => c[0] === "/api/location/status");
    expect(posts).toHaveLength(0);
    expect(beats.length).toBeGreaterThanOrEqual(1);
    const body = JSON.parse(String((beats[0]?.[1] as RequestInit).body));
    expect(body).not.toHaveProperty("latitude");
    expect(body.trackingState).toBeTruthy();
  });

  it("forces an immediate GPS ping when the tab becomes visible or the network returns", async () => {
    act(() => initBackgroundLocation(true, qc));
    geoMock.gets.shift(); // initial fix attempt, not under test

    // Establish a previous fix so the accuracy gate would normally drop a
    // worse one — a wake-up must post regardless.
    act(() => geoMock.watch?.success(position(10)));
    await act(async () => {});
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockClear();

    const before = geoMock.getCurrentPosition.mock.calls.length;
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(geoMock.getCurrentPosition.mock.calls.length).toBe(before + 1);
    act(() => geoMock.gets.shift()?.success(position(50)));
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/location",
      expect.objectContaining({ method: "POST" }),
    );

    fetchMock.mockClear();
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    act(() => geoMock.gets.shift()?.success(position(50)));
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Listeners die with the watch: a stopped tracker must not ping.
    act(() => initBackgroundLocation(false, qc));
    const stopped = geoMock.getCurrentPosition.mock.calls.length;
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(geoMock.getCurrentPosition.mock.calls.length).toBe(stopped);
  });
});
