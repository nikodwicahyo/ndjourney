// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { usePhotos, usePhoto } from "@/hooks/usePhotos";

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

const page1 = {
  data: [{ id: "p1", url: "https://x/y.jpg" }],
  nextCursor: "cursor-2", hasMore: true, total: 2, fotoTotal: 2, videoTotal: 0,
};
const page2 = {
  data: [{ id: "p2", url: "https://x/z.jpg" }],
  nextCursor: null, hasMore: false, total: 2, fotoTotal: 2, videoTotal: 0,
};

describe("usePhotos (F-02 gallery data)", () => {
  it("loads pages, appends cursor filter to query, exposes pagination", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      seen.push(url);
      const u = new URL(url, "http://localhost");
      const body = u.searchParams.get("cursor") ? page2 : page1;
      return new Response(JSON.stringify(body), { status: 200 });
    }));
    const { result } = renderHook(() => usePhotos({ isFavorite: true, limit: 50 }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages).toHaveLength(1);
    expect(seen[0]).toContain("isFavorite=true");
    expect(seen[0]).toContain("limit=50");
    expect(result.current.hasNextPage).toBe(true);
  });

  it("surfaces server error message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Gagal total" }), { status: 500 })));
    const { result } = renderHook(() => usePhotos(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("Gagal total");
  });
});

describe("usePhoto detail (GAL lightbox data)", () => {
  it("fetches by id and returns photo", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      expect(url).toContain("/api/photos/abc");
      return new Response(JSON.stringify({ data: { id: "abc", caption: "hi" } }), { status: 200 });
    }));
    const { result } = renderHook(() => usePhoto("abc"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ id: "abc", caption: "hi" });
  });
});
