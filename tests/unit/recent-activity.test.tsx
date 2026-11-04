// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { RecentActivity as RecentActivityItem } from "@/types";

// The feed rows come from a TanStack query hook; the component under test only
// renders whatever `data` the hook yields, so mock the hook and skip the
// QueryClient provider entirely.
const feed = vi.hoisted(() => ({ current: [] as RecentActivityItem[] }));

vi.mock("@/hooks/useDashboard", () => ({
  useRecentActivity: () => ({
    data: feed.current,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

const { default: RecentActivity } = await import("@/components/dashboard/RecentActivity");

const user = { id: "u1", name: "Niko", image: null };

function item(overrides: Partial<RecentActivityItem>): RecentActivityItem {
  return {
    id: "a1",
    type: "photo",
    description: "Foto baru",
    createdAt: new Date(),
    user,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  feed.current = [];
});

describe("RecentActivity feed", () => {
  it("renders wish and game rows", () => {
    feed.current = [
      item({ id: "a1", type: "wish", description: "Ingin liburan ke Bali" }),
      item({ id: "a2", type: "game", description: "Menang catur" }),
    ];

    render(<RecentActivity />);

    expect(screen.getByText("Ingin liburan ke Bali")).toBeTruthy();
    expect(screen.getByText("Menang catur")).toBeTruthy();
    // every known type must resolve to an existing route
    expect(screen.getByText("Ingin liburan ke Bali").closest("a")?.getAttribute("href")).toBe("/wishlist");
    expect(screen.getByText("Menang catur").closest("a")?.getAttribute("href")).toBe("/games");
  });

  it("letter row links to the letters list, not /dashboard/letters/<activity-id>", () => {
    feed.current = [item({ id: "evt-1", type: "letter", description: "Surat baru" })];

    render(<RecentActivity />);

    expect(screen.getByText("Surat baru").closest("a")?.getAttribute("href")).toBe("/dashboard/letters");
  });

  it("renders an unknown type via the fallback config instead of crashing", () => {
    feed.current = [
      item({
        id: "a9",
        type: "surprise" as unknown as RecentActivityItem["type"],
        description: "Kejutan",
      }),
    ];

    render(<RecentActivity />);

    expect(screen.getByText("Kejutan")).toBeTruthy();
  });
});
