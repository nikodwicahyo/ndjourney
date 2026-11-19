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

    // Road distance 10 km falls into the "Satu kota" category.
    expect(screen.getByText("Satu kota")).toBeTruthy();
    // Walking is the default mode: same road distance, walking speed.
    expect(screen.getByText("1 jam 59 menit")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Mode Motor" }));
    expect(screen.getByText("20 menit")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Mode Mobil" }));
    // Car uses OSRM's own driving duration for the road route.
    expect(screen.getByText("15 menit")).toBeTruthy();
  });

  it("does not double-round a 11.5 km road distance into 12 km", () => {
    // Regression: AnimatedNumber used to round metres first, so 11499.8m
    // became 11500m and the card showed 12 km while the map showed 11 km.
    render(<DistanceCard state={state} distance={8200} roadRoute={{ ...road, distanceMeters: 11499.8 }} />);
    expect(screen.getByText("11 km")).toBeTruthy();
    expect(screen.queryByText("12 km")).toBeNull();
  });

  it("never turns a fallback route into a road ETA", () => {
    render(
      <DistanceCard
        state={state}
        distance={8200}
        roadRoute={{ ...road, source: "fallback", geometry: null, durationSeconds: null }}
      />,
    );
    expect(screen.queryByText("Satu kota")).toBeNull();
    expect(screen.getByText("Rute jalan tidak tersedia")).toBeTruthy();
  });

  it("shows a loading hint while the road route is pending", () => {
    render(<DistanceCard state={state} distance={8200} roadRoute={null} routeLoading />);
    expect(screen.getByText("Memuat rute jalan…")).toBeTruthy();
  });
});
