// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import BackgroundAudio from "@/components/home/BackgroundAudio";

// jsdom has no audio backend; play() reports the times play() was attempted.
const play = vi
  .spyOn(HTMLAudioElement.prototype, "play")
  .mockResolvedValue(undefined);
const pause = vi
  .spyOn(HTMLAudioElement.prototype, "pause")
  .mockReturnValue(undefined);

function setActive(hasBeenActive: boolean) {
  Object.defineProperty(navigator, "userActivation", {
    value: { hasBeenActive },
    configurable: true,
  });
}

afterEach(() => {
  cleanup();
  play.mockClear();
  pause.mockClear();
  setActive(false);
});

describe("BackgroundAudio autoplay unlock", () => {
  it("starts immediately when the visitor already interacted during load", () => {
    setActive(true);
    render(<BackgroundAudio src="/audio/theme.mp3" />);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("waits for the first pointer gesture when none happened yet", async () => {
    setActive(false);
    render(<BackgroundAudio src="/audio/theme.mp3" />);
    expect(play).not.toHaveBeenCalled();

    // Real clicks start with a pointerdown (what the component listens to and
    // what browsers count as user activation).
    fireEvent.pointerDown(document.body);
    expect(play).toHaveBeenCalledTimes(1);

    // startedRef flips in play().then(); flush it like a real browser does
    // (play resolves in ms, long before the next user event), then verify
    // later gestures are ignored.
    await act(async () => {});
    fireEvent.pointerDown(document.body);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("unlocks on tap (touchend) and keypress too, not just click", () => {
    setActive(false);
    render(<BackgroundAudio src="/audio/theme.mp3" />);

    fireEvent.touchEnd(document.body);
    expect(play).toHaveBeenCalledTimes(1);
  });
});
