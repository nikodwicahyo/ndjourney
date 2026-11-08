// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

// Regression coverage for "?photo=<id>" / "?note=<id>" deep links.
// Both bugs came from consuming the URL param before the query had data:
//  - gallery: the effect depended on `photos`, so every refetch re-opened the
//    lightbox the user had already closed.
//  - notes: the render-phase check marked the param consumed on the first
//    render, when the date-scoped list was still empty, so it never fired.
const state = vi.hoisted(() => ({
  search: "",
  photos: [] as { id: string }[],
  fetchPhoto: undefined as unknown,
  notes: undefined as unknown,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(state.search),
}));

vi.mock("next/dynamic", () => ({
  default: () =>
    function LightboxStub(props: {
      isOpen: boolean;
      currentIndex: number;
      photos: unknown[];
      onClose: () => void;
    }) {
      return createElement(
        "div",
        {
          "data-testid": "lightbox",
          "data-open": String(props.isOpen),
          "data-index": String(props.currentIndex),
          "data-count": String(props.photos.length),
        },
        createElement("button", { type: "button", onClick: props.onClose }, "tutup"),
      );
    },
}));

vi.mock("@/components/gallery/PhotoCard", () => ({
  default: ({ photo }: { photo: { id: string } }) =>
    createElement("div", { "data-testid": "photo-card" }, photo.id),
}));

vi.mock("@/components/dashboard/AlbumManager", () => ({ default: () => null }));

vi.mock("@/hooks/useStorage", () => ({
  useStorageUsage: () => ({ data: null, isLoading: false, isFetching: false, refetch: vi.fn() }),
}));

vi.mock("@/hooks/usePhotos", () => ({
  usePhotos: () => ({
    data: { pages: [{ data: state.photos, total: state.photos.length }] },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  }),
  useAlbums: () => ({ data: undefined }),
  usePhoto: (id: string) => ({ data: id ? state.fetchPhoto : undefined }),
  useUploadPhotos: () => ({
    queue: [],
    uploadFiles: vi.fn(),
    removeUpload: vi.fn(),
    cancelAllUploads: vi.fn(),
    clearAllItems: vi.fn(),
    retryUpload: vi.fn(),
    pauseUpload: vi.fn(),
  }),
  useDeletePhoto: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useUpdatePhoto: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/hooks/useNotes", () => ({
  useDailyNotes: () => ({ data: state.notes, isLoading: false, error: null }),
  useCreateNote: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useDeleteNote: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null }) }));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

vi.mock("@/lib/swal", () => ({ showDeleteConfirm: vi.fn(async () => true) }));

vi.stubGlobal(
  "IntersectionObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const { default: GalleryManager } = await import("@/components/dashboard/GalleryManager");
const { default: NotesManager } = await import("@/components/dashboard/NotesManager");

function renderGallery() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return render(<GalleryManager />, { wrapper });
}

function lightbox() {
  return screen.getByTestId("lightbox");
}

afterEach(() => {
  cleanup();
  state.search = "";
  state.photos = [];
  state.fetchPhoto = undefined;
  state.notes = undefined;
});

describe("gallery ?photo=<id>", () => {
  it("opens once, stays closed after the user closes it, and survives a refetch", () => {
    state.photos = [{ id: "p1" }, { id: "p2" }];
    state.search = "photo=p2";

    const { rerender } = renderGallery();
    expect(lightbox().dataset.open).toBe("true");
    expect(lightbox().dataset.index).toBe("1");

    fireEvent.click(screen.getByRole("button", { name: "tutup" }));
    expect(lightbox().dataset.open).toBe("false");

    // Refetch: same param, brand-new photo objects.
    state.photos = [{ id: "p1" }, { id: "p2" }, { id: "p3" }];
    rerender(<GalleryManager />);
    expect(lightbox().dataset.open).toBe("false");
  });

  it("opens the lightbox again when the link points at another photo", () => {
    state.photos = [{ id: "p1" }, { id: "p2" }];
    state.search = "photo=p1";

    const { rerender } = renderGallery();
    expect(lightbox().dataset.index).toBe("0");
    fireEvent.click(screen.getByRole("button", { name: "tutup" }));

    state.search = "photo=p2";
    rerender(<GalleryManager />);
    expect(lightbox().dataset.open).toBe("true");
    expect(lightbox().dataset.index).toBe("1");
  });

  it("fetches a photo that the current filter/page does not contain", () => {
    // e.g. a private upload while the grid is filtered to public.
    state.photos = [{ id: "p1" }];
    state.search = "photo=private-1";
    state.fetchPhoto = { id: "private-1", url: "https://res.cloudinary.com/x/image/upload/a.jpg" };

    renderGallery();
    expect(lightbox().dataset.open).toBe("true");
    expect(lightbox().dataset.index).toBe("0");
    expect(lightbox().dataset.count).toBe("1");
  });
});

describe("notes ?note=<id>", () => {
  it("opens the note after the list has loaded, on that note's day", () => {
    const note = {
      id: "n1",
      content: "catatan target",
      authorId: "u1",
      // Jakarta midnight of 2024-02-14 stored as UTC.
      date: new Date("2024-02-13T17:00:00.000Z"),
      createdAt: new Date("2024-02-14T03:00:00.000Z"),
      author: { id: "u1", name: "Niku", image: null },
    };

    state.search = "note=n1";
    state.notes = undefined;

    const { rerender } = render(<NotesManager />);
    expect(screen.queryByText("catatan target")).toBeNull();

    // The query resolves after the first render.
    state.notes = [note];
    rerender(<NotesManager />);

    expect(screen.getByText("catatan target")).toBeTruthy();
    expect((screen.getByLabelText("Filter tanggal") as HTMLInputElement).value).toBe("2024-02-14");
  });
});
