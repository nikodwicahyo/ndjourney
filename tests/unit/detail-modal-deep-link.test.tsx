// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

// Deep links from push/notification/recent activity ("?wish=<id>" /
// "?milestone=<id>") must open the DETAIL modal for that item — not the edit
// form (wishes) or a scroll-anchor (milestones) — and must stay closed once
// the user dismisses them.
const state = vi.hoisted(() => ({
  search: "",
  wishes: undefined as Array<Record<string, unknown>> | undefined,
  milestones: undefined as Array<Record<string, unknown>> | undefined,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(state.search),
}));

vi.mock("next/dynamic", () => ({
  default: () => function FormStub() {
    return createElement("div", { "data-testid": "form-stub" });
  },
}));

vi.mock("@/components/wishlist/WishForm", () => ({ default: () => null }));

vi.mock("@/hooks/useWishes", () => ({
  useWishes: () => ({ data: state.wishes, isLoading: false, error: null, refetch: vi.fn() }),
  useToggleWish: () => ({ isPending: false, mutateAsync: vi.fn(async () => ({})) }),
}));

vi.mock("@/hooks/useMilestones", () => ({
  useMilestones: () => ({ data: state.milestones, isLoading: false, error: null, refetch: vi.fn() }),
  useDeleteMilestone: () => ({ isPending: false, mutateAsync: vi.fn(async () => ({})) }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/swal", () => ({ showDeleteConfirm: vi.fn(async () => false) }));

vi.stubGlobal(
  "IntersectionObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const WISH = {
  id: "w2",
  title: "Wish deep link",
  description: "detail yang dituju",
  imageUrl: null,
  link: null,
  category: "GIFTS",
  isDone: false,
  doneAt: null,
  createdAt: new Date("2024-02-14T00:00:00.000Z"),
  updatedAt: new Date("2024-02-14T00:00:00.000Z"),
  coupleId: "c1",
  createdById: "u1",
};

const MILESTONE = {
  id: "m2",
  title: "Milestone deep link",
  description: "deskripsi yang dituju",
  date: new Date("2024-02-14T00:00:00.000Z"),
  icon: null,
  color: null,
  location: null,
  isPublic: true,
  createdById: "u1",
  createdAt: new Date("2024-02-14T00:00:00.000Z"),
  updatedAt: new Date("2024-02-14T00:00:00.000Z"),
  createdBy: { id: "u1", name: "Niku", image: null },
  photos: [],
};

const { default: WishlistManager } = await import("@/components/dashboard/WishlistManager");
const { default: TimelineManager } = await import("@/components/dashboard/TimelineManager");

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return render(ui, { wrapper });
}

afterEach(() => {
  cleanup();
  state.search = "";
  state.wishes = undefined;
  state.milestones = undefined;
});

describe("wishlist ?wish=<id> deep link", () => {
  it("opens the detail modal for that wish, not the edit form", () => {
    state.wishes = [{ ...WISH, id: "w1" }, WISH];
    state.search = "wish=w2";

    renderWithClient(createElement(WishlistManager));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getAllByText("Wish deep link").length).toBeGreaterThan(0);
  });

  it("waits for the list, then opens once; stays closed after dismissal", () => {
    state.search = "wish=w2";
    state.wishes = undefined;

    const { rerender } = renderWithClient(createElement(WishlistManager));
    expect(screen.queryByRole("dialog")).toBeNull();

    // The query resolves after the first render — the modal must open once data arrives.
    state.wishes = [{ ...WISH, id: "w1" }, WISH];
    rerender(createElement(WishlistManager));
    expect(screen.getByRole("dialog")).toBeTruthy();

    // Dismiss via the modal's Tutup button.
    fireEvent.click(screen.getByRole("button", { name: "Tutup" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    // Re-render must not resurrect the modal.
    rerender(createElement(WishlistManager));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("timeline ?milestone=<id> deep link", () => {
  it("opens the detail modal for that milestone", () => {
    state.milestones = [{ ...MILESTONE, id: "m1" }, MILESTONE];
    state.search = "milestone=m2";

    renderWithClient(createElement(TimelineManager));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getAllByText("Milestone deep link").length).toBeGreaterThan(0);
  });

  it("stays closed after the user dismisses the modal", () => {
    state.milestones = [MILESTONE];
    state.search = "milestone=m2";

    const { rerender } = renderWithClient(createElement(TimelineManager));
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Tutup" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    rerender(createElement(TimelineManager));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
