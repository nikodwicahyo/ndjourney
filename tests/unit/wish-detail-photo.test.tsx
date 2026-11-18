// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, useState, type ReactNode } from "react";

// The wish detail modal must offer a working fullscreen view of the wish
// image: tappable banner → full-screen uncropped image, closable via X /
// backdrop / Escape, with the dialog underneath staying put.
vi.mock("@/hooks/useWishes", () => ({
  useToggleWish: () => ({ isPending: false, mutateAsync: vi.fn(async () => ({})) }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const WISH = {
  id: "w1",
  title: "Wishes test photonya",
  description: "detail",
  imageUrl:
    "https://res.cloudinary.com/demo/image/upload/v1/wishes/sample.jpg",
  imageCrop: null,
  link: null,
  category: "OTHER",
  isDone: false,
  doneAt: null,
  createdAt: new Date("2024-02-14T00:00:00.000Z"),
  updatedAt: new Date("2024-02-14T00:00:00.000Z"),
  coupleId: "c1",
  createdById: "u1",
};

const { default: WishDetailDialog } = await import(
  "@/components/wishlist/WishDetailDialog"
);

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return render(ui, { wrapper });
}

function overlayImg(): HTMLImageElement | null {
  return document.body.querySelector(
    '[role="dialog"][aria-label] img',
  ) as HTMLImageElement | null;
}

afterEach(() => cleanup());

describe("wish detail fullscreen image", () => {
  it("opens the fullscreen overlay from the banner and serves the uncropped high-res variant", () => {
    const spy = vi.fn();
    renderWithClient(createElement(WishDetailDialog, { wish: WISH, open: true, onOpenChange: spy }));

    // The banner is a real button wrapping the cropped preview.
    fireEvent.click(screen.getByRole("button", { name: /Lihat gambar penuh/ }));

    // Overlay is a labelled dialog layered above the modal (portal to body).
    const overlay = screen.getByRole("dialog", { name: WISH.title });
    expect(overlay).toBeTruthy();

    const src = overlayImg()?.getAttribute("src") ?? "";
    // Uncropped fullscreen source at high width — never the cropped preview.
    expect(src).toContain("w_1920");
    expect(src).not.toContain("c_fill");

    // The modal underneath is not closed by the overlay opening.
    expect(spy).not.toHaveBeenCalled();
  });

  it("closes the overlay first on Escape, preserving the modal; second Escape closes the modal", () => {
    const spy = vi.fn();
    renderWithClient(createElement(WishDetailDialog, { wish: WISH, open: true, onOpenChange: spy }));

    const banner = screen.getByRole("button", { name: /Lihat gambar penuh/ });
    fireEvent.click(banner);
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: WISH.title })).toBeNull();
    expect(spy).not.toHaveBeenCalled(); // modal stayed open
    expect(document.activeElement).toBe(banner); // focus returned to the trigger

    fireEvent.keyDown(document, { key: "Escape" });
    expect(spy).toHaveBeenCalledWith(false); // now the modal closes
  });

  it("hides the modal from assistive tech while the overlay is open", () => {
    renderWithClient(createElement(WishDetailDialog, { wish: WISH, open: true, onOpenChange: vi.fn() }));

    const banner = screen.getByRole("button", { name: /Lihat gambar penuh/ });
    fireEvent.click(banner);

    const modal = banner.closest('[role="dialog"]') as HTMLElement;
    expect(modal.getAttribute("aria-hidden")).toBe("true");

    // Closing the overlay restores it.
    fireEvent.click(screen.getByRole("button", { name: "Tutup foto" }));
    expect(modal.getAttribute("aria-hidden")).toBeNull();
  });

  it("shows a readable fallback when the fullscreen image fails to load", () => {
    renderWithClient(createElement(WishDetailDialog, { wish: WISH, open: true, onOpenChange: vi.fn() }));

    fireEvent.click(screen.getByRole("button", { name: /Lihat gambar penuh/ }));
    const img = overlayImg();
    expect(img).toBeTruthy();
    fireEvent.error(img as HTMLImageElement);

    expect(screen.getByText("Gagal memuat gambar")).toBeTruthy();
    // Still dismissible — an image failure must not trap the user.
    fireEvent.click(screen.getByRole("button", { name: "Tutup foto" }));
    expect(screen.queryByRole("dialog", { name: WISH.title })).toBeNull();
  });

  it("closes the overlay via the X button and returns focus to the banner", () => {
    const spy = vi.fn();
    renderWithClient(createElement(WishDetailDialog, { wish: WISH, open: true, onOpenChange: spy }));

    const banner = screen.getByRole("button", { name: /Lihat gambar penuh/ });
    fireEvent.click(banner);
    fireEvent.click(screen.getByRole("button", { name: "Tutup foto" }));

    expect(screen.queryByRole("dialog", { name: WISH.title })).toBeNull();
    expect(spy).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(banner);
  });

  it("clicking anywhere on the overlay backdrop closes it, not the modal", () => {
    const spy = vi.fn();
    renderWithClient(createElement(WishDetailDialog, { wish: WISH, open: true, onOpenChange: spy }));

    fireEvent.click(screen.getByRole("button", { name: /Lihat gambar penuh/ }));
    fireEvent.click(screen.getByRole("dialog", { name: WISH.title }));

    expect(screen.queryByRole("dialog", { name: WISH.title })).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("resets the zoom state when the dialog closes and reopens", () => {
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button onClick={() => setOpen(true)}>reopen</button>
          <WishDetailDialog wish={WISH} open={open} onOpenChange={setOpen} />
        </>
      );
    }

    renderWithClient(createElement(Harness));
    fireEvent.click(screen.getByRole("button", { name: /Lihat gambar penuh/ }));
    expect(screen.getByRole("dialog", { name: WISH.title })).toBeTruthy();

    // Close the modal entirely (Escape travels through the dialog's handler).
    fireEvent.keyDown(document, { key: "Escape" }); // closes overlay only
    fireEvent.keyDown(document, { key: "Escape" }); // closes the modal
    expect(screen.queryByRole("dialog", { name: WISH.title })).toBeNull();

    // Reopen — the overlay must not resurrect, and the banner is back.
    fireEvent.click(screen.getByRole("button", { name: "reopen" }));
    expect(screen.queryByRole("dialog", { name: WISH.title })).toBeNull();
    expect(screen.getByRole("button", { name: /Lihat gambar penuh/ })).toBeTruthy();
  });
});
