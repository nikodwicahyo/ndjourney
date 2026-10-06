// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
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
  takenAt: null,
  width: 800,
  height: 600,
  isVideo: false,
  isFavorite: false,
  isPublic: true,
  albumId: null,
  uploadedById: "u1",
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as PhotoWithUploader;

function renderLightbox(showDownload?: boolean) {
  render(
    <Lightbox
      photos={[PHOTO]}
      currentIndex={0}
      isOpen
      onClose={vi.fn()}
      onNavigate={vi.fn()}
      {...(showDownload === undefined ? {} : { showDownload })}
    />,
  );
  return screen.queryByRole("button", { name: "Unduh" });
}

// Download is an authenticated-only capability: hidden by default, shown
// only when the caller opts in (dashboard always, public gallery iff authed).
describe("Lightbox download gating", () => {
  it("shows the download button when showDownload", () => {
    expect(renderLightbox(true)).not.toBeNull();
  });

  it("hides the download button by default", () => {
    expect(renderLightbox()).toBeNull();
  });

  it("hides the download button when showDownload={false}", () => {
    expect(renderLightbox(false)).toBeNull();
  });
});
