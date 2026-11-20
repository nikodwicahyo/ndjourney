// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { createElement } from "react";

const session = vi.hoisted(() => ({ status: "unauthenticated" as string }));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: session.status, data: null }),
}));

// Only the location widget renders this marker — its presence tells us the
// reserved location slot was mounted at all.
vi.mock("@/components/location/LocationWidget", () => ({
  default: () => createElement("div", null, "Jarak Antar Kita"),
}));

// Reveal/MotionRoot mount immediately in jsdom so the marker is observable.
vi.mock("@/components/home/Reveal", () => ({
  default: ({ children }: { children: React.ReactNode }) =>
    createElement("section", { className: "reveal-slot" }, children),
}));
vi.mock("@/components/MotionRoot", () => ({
  default: ({ children }: { children: React.ReactNode }) => createElement("div", null, children),
}));

const stub = () => () => null;
vi.mock("@/components/home/CountdownTimer", () => ({ default: stub() }));
vi.mock("@/components/home/BirthdayCountdown", () => ({ default: stub() }));
vi.mock("@/components/home/QuoteOfTheDay", () => ({ default: stub() }));
vi.mock("@/components/home/GallerySlideshow", () => ({ default: stub() }));
vi.mock("@/components/home/LoveMeter", () => ({ default: stub() }));
vi.mock("@/components/home/DailyLoveTask", () => ({ default: stub() }));
vi.mock("@/components/home/BottleLetter", () => ({ default: stub() }));
vi.mock("@/components/home/MemoryMatch", () => ({ default: stub() }));
vi.mock("@/hooks/useMediaQuery", () => ({ useMediaQuery: () => false }));
vi.mock("@/hooks/useJakartaToday", () => ({ useJakartaToday: () => new Date() }));

const { default: HomeBelowFold } = await import("@/components/home/HomeBelowFold");

const props = {
  coupleConfig: { name1: "Niko", name2: "Dzikria", anniversaryDate: "2020-01-01" },
  galleryPhotos: [],
  summaries: {
    timeline: { milestoneCount: 0 },
    notes: { noteCount: 0 },
    games: { questionCount: 0, totalGamesPlayed: 0 },
    wishlist: { total: 0, done: 0 },
    letters: { totalCount: 0 },
  },
  loveMeterTargets: {
    milestoneCount: 0,
    notesCount: 0,
    lettersCount: 0,
    photosCount: 0,
    targetMilestones: 0,
    targetNotes: 0,
    targetLetters: 0,
    targetPhotos: 0,
    targetSetAt: null,
    targetMetAt: null,
  },
};

afterEach(() => {
  cleanup();
  session.status = "unauthenticated";
});

describe("home location slot", () => {
  it("reserves no gap for guests — the location slot is not mounted", () => {
    session.status = "unauthenticated";
    render(createElement(HomeBelowFold, props as never));
    expect(screen.queryByText("Jarak Antar Kita")).toBeNull();
  });

  it("shows the location card for authenticated visitors", () => {
    session.status = "authenticated";
    render(createElement(HomeBelowFold, props as never));
    expect(screen.getByText("Jarak Antar Kita")).toBeTruthy();
  });
});
