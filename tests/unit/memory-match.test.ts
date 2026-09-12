import { describe, it, expect } from "vitest";
import { selectMemoryMatchImages } from "@/components/home/MemoryMatch";
import { selectSlideshowMedia } from "@/components/home/GallerySlideshow";

// Memory Match must only ever show public images — never videos, never private
describe("selectMemoryMatchImages", () => {
  const img = { id: "i1", url: "https://res.cloudinary.com/x/image/upload/a.jpg", isVideo: false, isPublic: true };
  const video = { id: "v1", url: "https://res.cloudinary.com/x/video/upload/b.mp4", isVideo: true, isPublic: true };
  // stale row: flag missing but url is clearly a video
  const sneaky = { id: "v2", url: "https://res.cloudinary.com/x/video/upload/c.mp4", isVideo: false, isPublic: true };
  const privImg = { id: "i9", url: "https://res.cloudinary.com/x/image/upload/p.jpg", isVideo: false, isPublic: false };
  const extlessVideo = { id: "v4", url: "https://res.cloudinary.com/x/video/upload/v123/folder/clip", isVideo: false, isPublic: true };
  const heic = { id: "h1", url: "https://res.cloudinary.com/x/image/upload/photo.heic", isVideo: false, isPublic: true };
  const empty = { id: "e1", url: "", isVideo: false, isPublic: true };

  it("drops flagged videos", () => {
    expect(selectMemoryMatchImages([img, video])).toEqual([img]);
  });

  it("drops videos even when isVideo flag is stale/missing", () => {
    expect(selectMemoryMatchImages([img, sneaky])).toEqual([img]);
  });

  it("drops private images even when public flag is explicit false", () => {
    expect(selectMemoryMatchImages([img, privImg])).toEqual([img]);
  });

  it("drops extensionless video URLs, HEIC, and empty urls", () => {
    expect(selectMemoryMatchImages([img, extlessVideo])).toEqual([img]);
    expect(selectMemoryMatchImages([img, heic])).toEqual([img]);
    expect(selectMemoryMatchImages([img, empty])).toEqual([img]);
  });

  it("keeps images with query strings, drops video extensions", () => {
    const withQuery = { ...img, id: "i2", url: "https://x/a.jpg?foo=bar" };
    const mov = { id: "v3", url: "https://x/b.mov", isVideo: false };
    expect(selectMemoryMatchImages([withQuery, mov])).toEqual([withQuery]);
  });

  it("empty in → empty out (caller falls back to placeholders)", () => {
    expect(selectMemoryMatchImages([])).toEqual([]);
    expect(selectMemoryMatchImages([video])).toEqual([]);
  });
});

// GallerySlideshow is public: only public media, capped at 50
describe("selectSlideshowMedia", () => {
  const pub = (id: string, extra = {}) => ({ id, url: `https://x/${id}.jpg`, isVideo: false, isPublic: true, ...extra });
  const priv = { id: "p0", url: "https://x/p0.jpg", isVideo: false, isPublic: false };
  const pubVideo = { id: "v0", url: "https://x/v0.mp4", isVideo: true, isPublic: true };

  it("drops private rows but keeps public photos AND videos", () => {
    expect(selectSlideshowMedia([pub("a"), priv, pubVideo])).toEqual([pub("a"), pubVideo]);
  });

  it("treats missing isPublic (stale cache) as public", () => {
    const legacy = { id: "old", url: "https://x/old.jpg", isVideo: false };
    expect(selectSlideshowMedia([legacy, priv])).toEqual([legacy]);
  });

  it("caps at 50", () => {
    const many = Array.from({ length: 60 }, (_, i) => pub(`p${i}`));
    expect(selectSlideshowMedia(many)).toHaveLength(50);
  });
});
