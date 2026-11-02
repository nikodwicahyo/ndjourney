// @vitest-environment jsdom
// Pins the photo-hero vs video-hero contract: identical where it must be
// (scrim, legibility text, save payload shape), branching exactly where the
// media differs (crop, preview element, preload).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import HeroSection from "@/components/home/HeroSection";
import SettingsForm from "@/components/dashboard/SettingsForm";
import GalleryPicker from "@/components/ui/GalleryPicker";

const IMG_URL = "https://res.cloudinary.com/test-cloud/image/upload/v1/ndjourney-web/u1/hero.jpg";
const VIDEO_URL = "https://res.cloudinary.com/test-cloud/video/upload/v1/ndjourney-web/u1/hero.mp4";

vi.mock("@/hooks/useDashboard", () => ({ useCoupleConfig: vi.fn() }));
vi.mock("@tanstack/react-query", () => {
  const invalidateQueries = vi.fn();
  return { useQueryClient: () => ({ invalidateQueries }), QueryClientProvider: ({ children }: { children: React.ReactNode }) => children };
});
vi.mock("@/lib/api-client", () => ({ api: { put: vi.fn(() => Promise.resolve({ error: null })) } }));
vi.mock("@/lib/swal", () => ({ showDeleteConfirm: vi.fn(() => Promise.resolve(true)) }));
vi.mock("@/lib/chunked-upload", () => ({ uploadFileSimple: vi.fn() }));

const { useCoupleConfig } = await import("@/hooks/useDashboard");

function configWith(heroPhotoUrl: string | null, heroCrop: unknown = null) {
  return {
    name1: "Niko",
    name2: "Dzikria",
    tagline: "Dua hati, satu cerita",
    heroPhotoUrl,
    heroCrop,
    anniversaryDate: "2020-02-14",
    birthDate1: null,
    birthDate2: null,
    spotifyPlaylistUrl: "",
    backgroundMusicUrl: "",
  };
}

afterEach(() => {
  cleanup();
  vi.mocked(useCoupleConfig).mockReset();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  // jsdom has no ResizeObserver; the hero preview measures its 16:9 frame with one.
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});

describe("HeroSection: photo vs video consistency", () => {
  it("both media types show scrim + white legibility text", async () => {
    for (const url of [IMG_URL, VIDEO_URL]) {
      const { container } = render(
        <HeroSection name1="Niko" name2="Dzikria" tagline="t" heroPhotoUrl={url} />,
      );
      expect(screen.getByTestId("hero-scrim")).toBeTruthy(); // aria-checked readability identical
      const title = await screen.findByText("Niko", {}, { timeout: 5000 });
      expect(title.className).toContain("text-white");
      container.remove();
    }
  });

  it("branches on element: photos use next/image, videos use <video> with responsive sources", () => {
    const imgResult = render(
      <HeroSection name1="Niko" name2="Dzikria" heroPhotoUrl={IMG_URL} />,
    );
    expect(imgResult.container.querySelector("img")).toBeTruthy();
    expect(imgResult.container.querySelector("video")).toBeNull();
    cleanup();

    const vidResult = render(
      <HeroSection name1="Niko" name2="Dzikria" heroPhotoUrl={VIDEO_URL} />,
    );
    const video = vidResult.container.querySelector("video");
    expect(video).toBeTruthy();
    expect(vidResult.container.querySelector("img")).toBeNull();
    expect(video?.hasAttribute("autoplay")).toBe(true);
    expect(video?.hasAttribute("loop")).toBe(true);
    expect(video?.muted).toBe(true);
    expect(video?.hasAttribute("playsinline")).toBe(true);
    expect(video?.getAttribute("preload")).toBe("metadata");
    expect(video?.getAttribute("poster")).toContain("/image/upload/");
    expect(vidResult.container.querySelectorAll("source").length).toBe(3);
  });

  it("crop applies ONLY to photos; video with a legacy crop still renders uncropped", () => {
    const CROP = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
    render(<HeroSection name1="Niko" name2="Dzikria" heroPhotoUrl={IMG_URL} heroCrop={CROP} />);
    // photo + crop: still an image element (transform math applies after the
    // real image loads — jsdom cannot fire onLoad, so crop styles stay null).
    expect(screen.getByRole("img", { name: "Niko dan Dzikria" })).toBeTruthy();
    cleanup();

    // video + legacy crop: video renders; crop is ignored, no crash
    const { container: vidWithCrop } = render(
      <HeroSection name1="Niko" name2="Dzikria" heroPhotoUrl={VIDEO_URL} heroCrop={CROP} />,
    );
    expect(vidWithCrop.querySelector("video")).toBeTruthy();
  });
});

describe("SettingsForm: hero media switches", () => {
  it("video config: video preview, no crop button, upload accepts video+image", async () => {
    vi.mocked(useCoupleConfig).mockReturnValue(
      { data: configWith(VIDEO_URL), isLoading: false } as never,
    );
    const { container } = render(<SettingsForm />);
    expect(container.querySelector('video[aria-label="Preview video beranda"]')).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
    // crop button hidden for videos; gallery entry point present
    expect(screen.queryByText("Atur Crop")).toBeNull();
    expect(screen.queryByText("Pilih dari Galeri")).toBeTruthy();
    const input = container.querySelector("#settings-hero") as HTMLInputElement;
    expect(input.getAttribute("accept")).toContain("video/mp4");
    expect(input.getAttribute("accept")).toContain("image/jpeg");
  });

  it("photo config: image preview with optimized src, crop button available", () => {
    vi.mocked(useCoupleConfig).mockReturnValue(
      { data: configWith(IMG_URL), isLoading: false } as never,
    );
    const { container } = render(<SettingsForm />);
    expect(container.querySelector('video[aria-label="Preview video beranda"]')).toBeNull();
    const img = container.querySelector('img[alt="Hero"]');
    expect(img).toBeTruthy();
    // next/image proxies the optimized Cloudinary URL through its loader
    expect(decodeURIComponent(img?.getAttribute("src") ?? "")).toContain("/image/upload/");
    expect(screen.queryByText("Atur Crop")).toBeTruthy();
  });

  it("legacy row: video URL carrying a stale crop never shows crop controls", () => {
    vi.mocked(useCoupleConfig).mockReturnValue(
      { data: configWith(VIDEO_URL, { x: 0.1, y: 0.1, w: 0.8, h: 0.8 }), isLoading: false } as never,
    );
    const { container } = render(<SettingsForm />);
    expect(container.querySelector("video")).toBeTruthy();
    expect(screen.queryByText("Ubah Crop")).toBeNull();
    expect(screen.queryByText("Atur Crop")).toBeNull();
  });
});

describe("GalleryPicker mediaType param", () => {
  function jsonResponse(data: unknown[], hasMore = false) {
    return new Response(JSON.stringify({ data, nextCursor: null, hasMore }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  const photo = {
    id: "p1",
    url: IMG_URL,
    thumbnailUrl: null,
  };

  it("photo-only default keeps mediaType=foto (unchanged for milestone/wish callers)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([photo]));
    vi.stubGlobal("fetch", fetchMock);
    render(<GalleryPicker open onClose={() => {}} onSelect={() => {}} />);
    await screen.findByText("Pilih Foto dari Galeri");
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("mediaType=foto");
    expect(url).toContain("visibility=public");
  });

  it("showVideos drops mediaType so the API lists photos AND videos", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([photo]));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <GalleryPicker open onClose={() => {}} onSelect={() => {}} showVideos title="Pilih Foto/Video dari Galeri" />,
    );
    await screen.findByText("Pilih Foto/Video dari Galeri");
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).not.toContain("mediaType=");
    expect(url).toContain("visibility=public");
  });
});
