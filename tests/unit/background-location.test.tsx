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

function position(accuracy = 10): GeolocationPosition {
  return {
    coords: {
      latitude: -6.2,
      longitude: 106.8,
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
});
