// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SlidingPuzzle from "@/components/games/SlidingPuzzle";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const pub = (id: string) => ({
  id,
  url: `https://res.cloudinary.com/x/image/upload/${id}.jpg`,
  thumbnailUrl: null,
  caption: null,
  isVideo: false,
  isPublic: true,
});
const priv = {
  id: "priv1",
  url: "https://res.cloudinary.com/x/image/upload/priv1.jpg",
  thumbnailUrl: null,
  caption: null,
  isVideo: false,
  isPublic: false,
};

function mockPages() {
  const fetchMock = vi.fn(async (url: string) => {
    const second = String(url).includes("cursor=");
    return {
      ok: true,
      json: async () =>
        second
          ? { data: [pub("b1")], nextCursor: null }
          : { data: [pub("a1"), priv], nextCursor: "c1" },
    };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderPicker() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={qc}>
      <SlidingPuzzle />
    </QueryClientProvider>,
  );
}

// Picker pages past the 100-photo cap via an explicit button —
// public-only on every page (server visibility=public + client gate).
describe("SlidingPuzzle photo picker load-more", () => {
  it("shows page 1, filters private, offers more", async () => {
    const fetchMock = mockPages();
    renderPicker();
    expect(await screen.findByAltText("Foto")).toBeTruthy();
    // private row never renders
    expect(fetchMock).toHaveBeenCalled();
    const url = String(fetchMock.mock.calls[0]?.[0] ?? "");
    expect(url).toContain("visibility=public");
    expect(screen.getByRole("button", { name: "Lihat Lebih Banyak" })).toBeTruthy();
  });

  it("loads page 2 on click and hides the button at the end", async () => {
    mockPages();
    renderPicker();
    await screen.findByAltText("Foto");
    fireEvent.click(screen.getByRole("button", { name: "Lihat Lebih Banyak" }));
    await screen.findByAltText("Foto", undefined);
    // both pages rendered (2 imgs), button gone (no more pages)
    expect(screen.getAllByAltText("Foto")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /Lihat Lebih Banyak|Memuat/ })).toBeNull();
  });
});
