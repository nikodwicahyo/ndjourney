// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import Lightbox from "@/components/gallery/Lightbox";
import type { PhotoWithUploader } from "@/types";

afterEach(() => {
  cleanup();
});

const PHOTO = {
  id: "p1",
  url: "https://res.cloudinary.com/test-cloud/image/upload/a.jpg",
  publicId: "test-cloud/u/a",
  thumbnailUrl: null,
  caption: null,
  width: 800,
  height: 600,
  isVideo: false,
  isFavorite: false,
  isPublic: true,
  albumId: null,
  uploadedById: "u1",
  createdAt: new Date(),
  updatedAt: new Date(),
  albumName: "Liburan di Bali",
} as unknown as PhotoWithUploader;

function openDetail() {
  render(
    <Lightbox
      photos={[PHOTO]}
      currentIndex={0}
      isOpen
      onClose={vi.fn()}
      onNavigate={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Detail" }));
}

describe("Lightbox detail media album", () => {
  it("shows the media's album name in Detail Media", () => {
    openDetail();
    expect(screen.getByText("Detail Media")).toBeTruthy();
    expect(screen.getByText("Album")).toBeTruthy();
    expect(screen.getByText("Liburan di Bali")).toBeTruthy();
  });

  it("falls back to unfiled when the media has no album", () => {
    render(
      <Lightbox
        photos={[{ ...PHOTO, albumName: null }]}
        currentIndex={0}
        isOpen
        onClose={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Detail" }));
    expect(screen.getByText("Tanpa album")).toBeTruthy();
  });
});
