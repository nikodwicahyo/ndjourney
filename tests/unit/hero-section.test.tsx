// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import HeroSection from "@/components/home/HeroSection";

// Controllable useReducedMotion. A plain {...spread} mock breaks `motion`
// (new component identities every access → remount loop), so proxy the real
// module and override only the hook.
vi.mock("framer-motion", async (importOriginal) => {
  const mod = await importOriginal<typeof import("framer-motion")>();
  return new Proxy(mod, {
    get(target, prop, receiver) {
      if (prop === "useReducedMotion")
        return () =>
          (globalThis as Record<string, unknown>).__testReducedMotion ??
          false;
      return Reflect.get(target, prop, receiver);
    },
  });
});

afterEach(() => {
  cleanup();
  delete (globalThis as Record<string, unknown>).__testReducedMotion;
});

// Photo heroes must be readable on ANY image with no text outline:
// a dark scrim carries the contrast, layered shadows crisp the glyphs.
describe("HeroSection readability", () => {
  it("photo hero: scrim present, no text-stroke, white title", async () => {
    const { container } = render(
      <HeroSection
        name1="Niko"
        name2="Dzikria"
        tagline="Tempat semua cerita kita tersimpan selamanya."
        heroPhotoUrl="https://res.cloudinary.com/x/video/upload/hero.mp4"
      />,
    );
    expect(screen.getByTestId("hero-scrim")).toBeTruthy();
    expect(container.innerHTML).not.toContain("text-stroke");
    const title = await screen.findByText("Niko", {}, { timeout: 5000 });
    expect(title.className).toContain("text-white");
  });

  it("no-photo hero: no scrim, themed title", async () => {
    const { container } = render(
      <HeroSection name1="Niko" name2="Dzikria" heroPhotoUrl={null} />,
    );
    expect(screen.queryByTestId("hero-scrim")).toBeNull();
    expect(container.innerHTML).not.toContain("text-stroke");
    const title = await screen.findByText("Niko", {}, { timeout: 5000 });
    expect(title.className).toContain("text-foreground");
  });

  it("first client paint matches SSR under reduced motion (no hydration mismatch)", () => {
    // Server: useReducedMotion() is null. A reduced-motion client hydrating
    // SSR HTML ("") while first-painting full names fails hydration
    // (span "" vs name). Initials must not depend on the hook — the mount
    // effect syncs it instead. flushSync paints synchronously WITHOUT
    // flushing passive effects, capturing exactly what hydration compares.
    const serverH1 = new DOMParser()
      .parseFromString(
        renderToStaticMarkup(
          <HeroSection name1="Niko" name2="Dzikria" heroPhotoUrl={null} />,
        ),
        "text/html",
      )
      .querySelector("h1")?.textContent;
    (globalThis as Record<string, unknown>).__testReducedMotion = true;
    const el = document.createElement("div");
    document.body.appendChild(el);
    const root = createRoot(el);
    flushSync(() => {
      root.render(
        <HeroSection name1="Niko" name2="Dzikria" heroPhotoUrl={null} />,
      );
    });
    try {
      expect(el.querySelector("h1")?.textContent).toBe(serverH1);
    } finally {
      root.unmount();
      el.remove();
    }
  });
});

describe("HeroSection video hero", () => {
  const VIDEO_URL = "https://res.cloudinary.com/x/video/upload/v1/ndjourney-web/u1/hero.mp4";

  it("renders a muted autoplay looping video with poster + metadata preload", () => {
    const { container } = render(
      <HeroSection name1="Niko" name2="Dzikria" heroPhotoUrl={VIDEO_URL} />,
    );
    const video = container.querySelector("video");
    expect(video).toBeTruthy();
    expect(video?.hasAttribute("autoplay")).toBe(true); // plays on every home visit
    expect(video?.hasAttribute("loop")).toBe(true);
    // React sets `muted` as a DOM property, not an attribute — assert the property.
    expect(video?.muted).toBe(true);
    expect(video?.hasAttribute("playsinline")).toBe(true);
    expect(video?.getAttribute("preload")).toBe("metadata");
    // instant first-frame paint while the video buffers
    expect(video?.getAttribute("poster")).toContain("/image/upload/");
    // crossOrigin not needed; no Image element for video heroes
    expect(container.querySelector("img")).toBeNull();

    // Responsive delivery: viewport-based source picking + optimized URLs.
    const sources = Array.from(container.querySelectorAll("source"));
    expect(sources.length).toBe(3);
    expect(sources[0].getAttribute("media")).toBe("(max-width: 639px)");
    expect(sources[0].getAttribute("src")).toContain("w_640");
    expect(sources[1].getAttribute("media")).toBe("(max-width: 1023px)");
    expect(sources[1].getAttribute("src")).toContain("w_960");
    expect(sources[2].getAttribute("media")).toBeNull();
    expect(sources[2].getAttribute("src")).toContain("w_1600");
    // no raw <video src> alongside <source> children (src would win)
    expect(video?.getAttribute("src")).toBeNull();
  });
});
