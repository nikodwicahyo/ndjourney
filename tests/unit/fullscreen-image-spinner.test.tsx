// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import FullscreenImage from "@/components/ui/FullscreenImage";

// The delay exists so a cached image never flashes a spinner; it must also
// disappear the moment the image loads or fails.
describe("FullscreenImage loading indicator", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("appears only after the delay, then disappears on load", async () => {
    vi.useFakeTimers();
    render(<FullscreenImage src="/foto.jpg" alt="Foto" onClose={() => {}} />);

    expect(screen.queryByText("Memuat gambar…")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(240);
    });
    expect(screen.queryByText("Memuat gambar…")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(screen.getByText("Memuat gambar…")).toBeTruthy();

    const img = document.querySelector("img");
    expect(img).toBeTruthy();
    // next/image reports load through img.decode(), so let microtasks settle.
    await act(async () => {
      fireEvent.load(img!);
    });
    expect(screen.queryByText("Memuat gambar…")).toBeNull();
  });

  it("shows the failure message instead of a spinner", () => {
    vi.useFakeTimers();
    render(<FullscreenImage src="/rusak.jpg" alt="Foto" onClose={() => {}} />);

    act(() => {
      document.querySelector("img")!.dispatchEvent(new Event("error"));
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByText("Gagal memuat gambar")).toBeTruthy();
    expect(screen.queryByText("Memuat gambar…")).toBeNull();
  });
});
