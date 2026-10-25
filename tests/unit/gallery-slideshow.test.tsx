// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import GallerySlideshow from "@/components/home/GallerySlideshow";

// Same controllable-hook pattern as hero-section.test.tsx: proxy the real
// module so `motion` keeps working, override only useReducedMotion.
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
  vi.useRealTimers();
  delete (globalThis as Record<string, unknown>).__testReducedMotion;
});

const photos = [
  {
    id: "p1",
    url: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
    caption: null,
    createdAt: null,
    isVideo: false,
  },
];

describe("GallerySlideshow hydration", () => {
  it("first client paint matches SSR under reduced motion", () => {
    // Variants/initial must be static: server (hook null) and a
    // reduced-motion client (hook true) have to produce identical HTML,
    // or hydration fails on the slide style + pause-button state.
    // flushSync paints synchronously WITHOUT flushing passive effects
    // (autoplay timer, image preload), capturing what hydration compares.
    // (Full innerHTML is NOT compared: SSR preload <link>s, attribute
    // order and style serialization differ harmlessly — React compares
    // props, so assert the hook-sensitive spots instead.)
    const serverDoc = new DOMParser().parseFromString(
      renderToStaticMarkup(<GallerySlideshow photos={photos} />),
      "text/html",
    );
    (globalThis as Record<string, unknown>).__testReducedMotion = true;
    const el = document.createElement("div");
    document.body.appendChild(el);
    const root = createRoot(el);
    flushSync(() => {
      root.render(<GallerySlideshow photos={photos} />);
    });
    try {
      const norm = (s: string | null | undefined) =>
        (s ?? "").replace(/\s+/g, "").replace(/;+$/, "");
      expect(
        norm(
          el
            .querySelector("div.absolute.inset-0[style]")
            ?.getAttribute("style"),
        ),
      ).toBe(
        norm(
          serverDoc
            .querySelector("div.absolute.inset-0[style]")
            ?.getAttribute("style"),
        ),
      );
      expect(
        el.querySelector('button[aria-label="Jeda tayangan"]')?.getAttribute("aria-pressed"),
      ).toBe(
        serverDoc
          .querySelector('button[aria-label="Jeda tayangan"]')
          ?.getAttribute("aria-pressed"),
      );
    } finally {
      root.unmount();
      el.remove();
    }
  });
});

const autoplayPhotos = [
  {
    id: "a1",
    url: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
    caption: null,
    createdAt: null,
    isVideo: false,
  },
  {
    id: "a2",
    url: "https://res.cloudinary.com/demo/image/upload/sample2.jpg",
    caption: null,
    createdAt: null,
    isVideo: false,
  },
];

describe("GallerySlideshow autoplay", () => {
  // next/image resolves its onLoad after decode(), so the event lands on a
  // microtask — await act() lets it flush before the fake clock advances.
  const loadCurrentMedia = async () => {
    await act(async () => {
      for (const img of screen.getAllByRole("img")) fireEvent.load(img);
    });
  };

  it("waits for the current media to load before advancing", async () => {
    vi.useFakeTimers();
    render(<GallerySlideshow photos={autoplayPhotos} />);
    expect(screen.getByText("1 / 2")).toBeTruthy();
    // Media never fired load: no timer may run on a blank/loading slide.
    act(() => {
      vi.advanceTimersByTime(9000);
    });
    expect(screen.getByText("1 / 2")).toBeTruthy();

    await loadCurrentMedia();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText("2 / 2")).toBeTruthy();
  });

  it("advances for reduced-motion users (desktop OS setting)", async () => {
    // Regression: the timer used to be gated on useReducedMotion(), which is
    // true on desktops with OS animation effects off — autoplay died there.
    (globalThis as Record<string, unknown>).__testReducedMotion = true;
    vi.useFakeTimers();
    render(<GallerySlideshow photos={autoplayPhotos} />);
    await loadCurrentMedia();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText("2 / 2")).toBeTruthy();
  });

  it("keeps advancing while the pointer rests on the card", async () => {
    // Hover-pause was invisible and desktop-only (phones never fire it).
    vi.useFakeTimers();
    const { container } = render(<GallerySlideshow photos={autoplayPhotos} />);
    await loadCurrentMedia();
    fireEvent.pointerOver(container.firstElementChild as HTMLElement);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText("2 / 2")).toBeTruthy();
  });
});
