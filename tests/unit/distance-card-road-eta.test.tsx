// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import DistanceCard from "@/components/location/DistanceCard";
import type { LocationState } from "@/hooks/useLocation";
import type { RoadRoute } from "@/lib/routing";

afterEach(cleanup);

const state: LocationState = {
  coupleId: "c1",
  meetThresholdMeters: 100,
  self: {
    userId: "u1", image: null, isSharing: true, deviceType: "mobile",
    location: { lat: -6.2, lng: 106.8, accuracy: 10, heading: null, speed: null, altitude: null, updatedAt: new Date().toISOString() },
    locationAgeSeconds: 1, isStale: false, name: "Kamu",
  },
  partner: {
    userId: "u2", image: null, isSharing: true, deviceType: "mobile",
    location: { lat: -6.26, lng: 106.85, accuracy: 10, heading: null, speed: null, altitude: null, updatedAt: new Date().toISOString() },
    locationAgeSeconds: 1, isStale: false, name: "Dzikria",
  },
};

const road: RoadRoute = {
  distanceMeters: 10000,
  durationSeconds: 900,
  geometry: [[-6.2, 106.8], [-6.26, 106.85]],
  source: "osrm",
};

describe("DistanceCard road-only ETA", () => {
  it("uses the road route and gives a distinct ETA per mode", () => {
    render(<DistanceCard state={state} distance={8200} roadRoute={road} />);

    expect(screen.getByText("Jarak tempuh via jalan")).toBeTruthy();
    // Walking is the default mode: same road distance, walking speed.
    expect(screen.getByText("1 jam 59 menit")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Mode Motor" }));
    expect(screen.getByText("20 menit")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Mode Mobil" }));
    // Car uses OSRM's own driving duration for the road route.
    expect(screen.getByText("15 menit")).toBeTruthy();
  });

  it("never turns a fallback route into a road ETA", () => {
    render(
      <DistanceCard
        state={state}
        distance={8200}
        roadRoute={{ ...road, source: "fallback", geometry: null, durationSeconds: null }}
      />,
    );
    expect(screen.queryByText("Jarak tempuh via jalan")).toBeNull();
    expect(screen.queryByText("via rute jalan")).toBeNull();
    expect(screen.getByText("Rute jalan tidak tersedia")).toBeTruthy();
  });

  it("shows a loading hint while the road route is pending", () => {
    render(<DistanceCard state={state} distance={8200} roadRoute={null} routeLoading />);
    expect(screen.getByText("Memuat rute jalan…")).toBeTruthy();
  });
});
