// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import MilestoneCard from "@/components/timeline/MilestoneCard";
import type { MilestoneWithRelations } from "@/hooks/useMilestones";

const showDeleteConfirmMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/swal", () => ({ showDeleteConfirm: showDeleteConfirmMock }));

vi.stubGlobal("IntersectionObserver", class {
  observe() {}
  unobserve() {}
  disconnect() {}
});
vi.stubGlobal("ResizeObserver", class {
  observe() {}
  unobserve() {}
  disconnect() {}
});

afterEach(() => {
  cleanup();
});

const MILESTONE = {
  id: "m1",
  title: "Anniversary",
  description: null,
  date: new Date("2024-02-14"),
  icon: null,
  color: null,
  location: null,
  isPublic: true,
  createdById: "u1",
  createdBy: { id: "u1", name: "A", image: null },
  createdAt: new Date(),
  updatedAt: new Date(),
  photos: [],
} as unknown as MilestoneWithRelations;

function renderCard(onDelete: (id: string) => void) {
  render(<MilestoneCard milestone={MILESTONE} isAuthenticated index={0} onDelete={onDelete} />);
  return screen.getByRole("button", { name: "Hapus milestone" });
}

// Double-dialog regression: confirmation lives ONLY in MilestoneCard — the
// managers (TimelineManager/TimelineList) must call onDelete straight into
// the mutation, never confirm again.
describe("MilestoneCard delete confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    showDeleteConfirmMock.mockResolvedValue(true);
  });

  it("asks once, then calls onDelete once with the id", async () => {
    const onDelete = vi.fn();
    fireEvent.click(renderCard(onDelete));
    await screen.findByRole("button", { name: "Hapus milestone" });
    expect(showDeleteConfirmMock).toHaveBeenCalledTimes(1);
    expect(showDeleteConfirmMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Hapus Milestone" }),
    );
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith("m1");
  });

  it("never calls onDelete when cancelled", async () => {
    showDeleteConfirmMock.mockResolvedValue(false);
    const onDelete = vi.fn();
    fireEvent.click(renderCard(onDelete));
    await new Promise((r) => setTimeout(r, 0));
    expect(showDeleteConfirmMock).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
  });
});
