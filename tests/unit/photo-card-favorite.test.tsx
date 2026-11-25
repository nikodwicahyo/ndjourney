// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import PhotoCard from "@/components/gallery/PhotoCard";
import type { Photo } from "@/types";

const photo = {
  id: "p1",
  url: "https://res.cloudinary.com/demo/image/upload/v1/a.jpg",
  publicId: "demo/a",
  thumbnailUrl: null,
  caption: "Pantai",
  width: 800,
  height: 600,
  isVideo: false,
  isFavorite: true,
  isPublic: true,
  albumId: null,
  uploadedById: "u1",
  createdAt: new Date(0),
  updatedAt: new Date(0),
} as Photo;

afterEach(cleanup);

describe("PhotoCard favorite marker", () => {
  it("marks a favorited tile on read-only surfaces without a toggle", () => {
    render(<PhotoCard photo={photo} />);

    const badge = screen.getByLabelText("Difavoritkan");
    // Display only: nothing to click, no favorite action exposed.
    expect(badge.tagName).toBe("SPAN");
    expect(screen.queryByLabelText("Hapus dari favorit")).toBeNull();
  });

  it("keeps the interactive toggle (and no duplicate badge) in the dashboard", () => {
    render(<PhotoCard photo={photo} onFavoriteToggle={() => {}} />);

    expect(screen.getByLabelText("Hapus dari favorit")).toBeTruthy();
    expect(screen.queryByLabelText("Difavoritkan")).toBeNull();
  });

  it("shows nothing on a non-favorited tile", () => {
    render(<PhotoCard photo={{ ...photo, isFavorite: false }} />);

    expect(screen.queryByLabelText("Difavoritkan")).toBeNull();
  });
});
