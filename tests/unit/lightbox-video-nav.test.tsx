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
} as unknown as PhotoWithUploader;

const VIDEO = {
  ...PHOTO,
  id: "v1",
  url: "https://res.cloudinary.com/test-cloud/video/upload/b.mp4",
  publicId: "test-cloud/u/b",
  isVideo: true,
} as unknown as PhotoWithUploader;

// Swipe surface: the slide wrapper inside the stage (not the <video>
// frame itself — gestures starting on native controls stay with the video).
function slideOf(container: HTMLElement): HTMLElement {
  const stage = container.querySelector(
    ".absolute.inset-0.grid",
  ) as HTMLElement;
  return stage.firstElementChild as HTMLElement;
}

function swipe(el: HTMLElement, x0: number, x1: number) {
  fireEvent.pointerDown(el, {
    pointerType: "touch",
    pointerId: 1,
    button: 0,
    clientX: x0,
    clientY: 400,
  });
  fireEvent.pointerMove(el, {
    pointerType: "touch",
    pointerId: 1,
    button: 0,
    clientX: (x0 + x1) / 2,
    clientY: 400,
  });
  fireEvent.pointerMove(el, {
    pointerType: "touch",
    pointerId: 1,
    button: 0,
    clientX: x1,
    clientY: 400,
  });
  fireEvent.pointerUp(el, {
    pointerType: "touch",
    pointerId: 1,
    button: 0,
    clientX: x1,
    clientY: 400,
  });
}

// Video navigates exactly like images: buttons, keys already worked —
// swipe was the gap (pointer-down early-returned on video).
describe("Lightbox video prev/next", () => {
  it("swipe left on video goes next", () => {
    const onNavigate = vi.fn();
    const { container } = render(
      <Lightbox
        photos={[VIDEO, PHOTO]}
        currentIndex={0}
        isOpen
        onClose={vi.fn()}
        onNavigate={onNavigate}
      />,
    );
    swipe(slideOf(container), 300, 200);
    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  it("swipe right on video goes prev", () => {
    const onNavigate = vi.fn();
    const { container } = render(
      <Lightbox
        photos={[PHOTO, VIDEO]}
        currentIndex={1}
        isOpen
        onClose={vi.fn()}
        onNavigate={onNavigate}
      />,
    );
    swipe(slideOf(container), 200, 300);
    expect(onNavigate).toHaveBeenCalledWith(0);
  });

  it("short drag on video does not navigate", () => {
    const onNavigate = vi.fn();
    const { container } = render(
      <Lightbox
        photos={[VIDEO, PHOTO]}
        currentIndex={0}
        isOpen
        onClose={vi.fn()}
        onNavigate={onNavigate}
      />,
    );
    swipe(slideOf(container), 300, 280);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("next button works on video", () => {
    const onNavigate = vi.fn();
    render(
      <Lightbox
        photos={[VIDEO, PHOTO]}
        currentIndex={0}
        isOpen
        onClose={vi.fn()}
        onNavigate={onNavigate}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Berikutnya" }));
    expect(onNavigate).toHaveBeenCalledWith(1);
  });
});
