// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import MusicPlayer from "@/components/home/MusicPlayer";

const SPOTIFY = "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M";

function panelOf(iframe: HTMLElement) {
  return iframe.closest("#music-player-panel");
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("MusicPlayer collapse", () => {
  it("keeps the Spotify iframe mounted when collapsed", () => {
    vi.useFakeTimers();
    render(<MusicPlayer spotifyUrl={SPOTIFY} />);

    fireEvent.click(screen.getByRole("button", { name: "Buka musik" }));
    const iframe = screen.getByTitle("Spotify Player");
    const panel = panelOf(iframe);

    expect(panel).not.toBeNull();
    expect(panel?.hasAttribute("inert")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Sembunyikan pemutar musik" }));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Same DOM node: the player was hidden, not unmounted/reloaded, so the
    // Spotify iframe keeps its playback state.
    expect(screen.getByTitle("Spotify Player")).toBe(iframe);
    expect(panel?.hasAttribute("inert")).toBe(true);
    expect(screen.getByRole("button", { name: "Tampilkan pemutar musik" })).toBeTruthy();
  });

  it("reopens the same iframe without reloading it", () => {
    vi.useFakeTimers();
    render(<MusicPlayer spotifyUrl={SPOTIFY} />);

    fireEvent.click(screen.getByRole("button", { name: "Buka musik" }));
    const iframe = screen.getByTitle("Spotify Player");

    fireEvent.click(screen.getByRole("button", { name: "Sembunyikan pemutar musik" }));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    fireEvent.click(screen.getByRole("button", { name: "Tampilkan pemutar musik" }));

    expect(screen.getByTitle("Spotify Player")).toBe(iframe);
    expect(panelOf(iframe)?.hasAttribute("inert")).toBe(false);
  });
});
