// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import { startMutationToast, settleMutationToast } from "@/lib/mutation-feedback";

vi.mock("sonner", () => ({
  toast: {
    loading: vi.fn(() => "t1"),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("mutation feedback helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts a loading toast and returns its id", () => {
    expect(startMutationToast("Menyimpan...")).toBe("t1");
    expect(toast.loading).toHaveBeenCalledWith("Menyimpan...", expect.objectContaining({ duration: Infinity }));
  });

  it("settles the loading toast with success on success", () => {
    settleMutationToast("t1", "success", "Wish ditambahkan!");
    expect(toast.success).toHaveBeenCalledWith("Wish ditambahkan!", expect.objectContaining({ id: "t1" }));
  });

  it("settles the loading toast with error on failure", () => {
    settleMutationToast("t1", "error", "Gagal menambahkan wish");
    expect(toast.error).toHaveBeenCalledWith("Gagal menambahkan wish", expect.objectContaining({ id: "t1" }));
  });
});
