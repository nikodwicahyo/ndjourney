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
    lastSeenAt: new Date().toISOString(), lastFixAt: new Date().toISOString(),
    trackingState: "foreground", shareExpiresAt: null,
  },
  partner: {
    userId: "u2", image: null, isSharing: true, deviceType: "mobile",
    location: { lat: -6.26, lng: 106.85, accuracy: 10, heading: null, speed: null, altitude: null, updatedAt: new Date().toISOString() },
    locationAgeSeconds: 1, isStale: false, name: "Dzikria",
    lastSeenAt: new Date().toISOString(), lastFixAt: new Date().toISOString(),
    trackingState: "foreground", shareExpiresAt: null,
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

  it("shows a precise 11.5 km instead of rounding to 11 or 12 km", () => {
    // Regression: rounding metres first produced 12 km, truncating km produced
    // 11 km. Both the card and map now show one decimal from the same helper.
    render(<DistanceCard state={state} distance={8200} roadRoute={{ ...road, distanceMeters: 11499.8 }} />);
    expect(screen.getByText("11.5 km")).toBeTruthy();
    expect(screen.queryByText("11 km")).toBeNull();
    expect(screen.queryByText("12 km")).toBeNull();
  });

  it("rotates a north-based arrow to the partner bearing", () => {
    // lucide's plain Navigation points north-east; using it would offset the
    // arrow by 45° from the label. Navigation2 points true north.
    const { container } = render(<DistanceCard state={state} distance={8200} roadRoute={road} />);
    const arrow = container.querySelector("svg.lucide-navigation-2");
    expect(arrow).toBeTruthy();
    expect(arrow?.getAttribute("style")).toMatch(/rotate\([\d.]+deg\)/);
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
    expect(screen.getByText("Jarak tidak tersedia")).toBeTruthy();
  });

  it("shows a loading hint while the road route is pending", () => {
    render(<DistanceCard state={state} distance={8200} roadRoute={null} routeLoading />);
    expect(screen.getByText("Memuat jarak…")).toBeTruthy();
  });
});
