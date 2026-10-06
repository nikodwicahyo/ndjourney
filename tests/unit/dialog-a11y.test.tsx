// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// F-01: dialog semantics — role/aria-modal, Escape close, focus in + restore.
describe("DialogContent accessibility", () => {
  it("renders role=dialog aria-modal and closes on Escape", () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Hapus?</DialogTitle>
          <button>Ya</button>
        </DialogContent>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("moves focus inside on open and restores it on close", () => {
    vi.useFakeTimers();
    const onOpenChange = vi.fn();
    const trigger = document.createElement("button");
    trigger.textContent = "open";
    document.body.appendChild(trigger);
    trigger.focus();
    const { rerender } = render(
      <Dialog open={false} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Hapus?</DialogTitle>
          <button>Tutup</button>
        </DialogContent>
      </Dialog>,
    );
    rerender(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Hapus?</DialogTitle>
          <button>Tutup</button>
        </DialogContent>
      </Dialog>,
    );
    act(() => {
      vi.runAllTimers();
    });
    // Focus lands on the first control inside the dialog (keyboard users start inside).
    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);
    rerender(
      <Dialog open={false} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Hapus?</DialogTitle>
          <button>Tutup</button>
        </DialogContent>
      </Dialog>,
    );
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
    vi.useRealTimers();
  });
});
