// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import HeroSection from "@/components/home/HeroSection";

afterEach(() => {
  cleanup();
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
    const title = await screen.findByText("Niko");
    expect(title.className).toContain("text-white");
  });

  it("no-photo hero: no scrim, themed title", async () => {
    const { container } = render(
      <HeroSection name1="Niko" name2="Dzikria" heroPhotoUrl={null} />,
    );
    expect(screen.queryByTestId("hero-scrim")).toBeNull();
    expect(container.innerHTML).not.toContain("text-stroke");
    const title = await screen.findByText("Niko");
    expect(title.className).toContain("text-foreground");
  });
});
