// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import BackgroundAudio from "@/components/home/BackgroundAudio";

// jsdom has no audio backend; the spy records every play() and the instance
// so tests can inspect `.muted`, mirroring the browser's autoplay decision:
// blockCount --- number of initial unmuted play() attempts to reject
//              (a browser without user activation).
const play = vi.spyOn(HTMLAudioElement.prototype, "play");
const pause = vi
  .spyOn(HTMLAudioElement.prototype, "pause")
  .mockReturnValue(undefined);
const els: HTMLAudioElement[] = [];
let blockCount = 0;

play.mockImplementation(function (this: HTMLAudioElement) {
  els.push(this);
  if (blockCount > 0) {
    blockCount--;
    return Promise.reject(new Error("NotAllowedError"));
  }
  return Promise.resolve();
});

function flushMicrotasks() {
  return act(async () => {});
}

afterEach(() => {
  cleanup();
  els.length = 0;
  blockCount = 0;
  play.mockClear();
  pause.mockClear();
});

describe("BackgroundAudio autoplay", () => {
  it("plays unmuted on mount when the browser allows it", async () => {
    render(<BackgroundAudio src="/audio/theme.mp3" />);
    await flushMicrotasks();
    expect(play).toHaveBeenCalledTimes(1);
    expect(els[0].muted).toBe(false);
  });

  it("falls back to muted autoplay and unmutes on the first tap", async () => {
    blockCount = 1; // no user activation → unmuted autoplay denied
    render(<BackgroundAudio src="/audio/theme.mp3" />);
    await flushMicrotasks();

    // Unmuted attempt rejected, then the muted fallback started it anyway.
    expect(play).toHaveBeenCalledTimes(2);
    expect(els[1].muted).toBe(true);

    // First tap/click/key anywhere unmutes it.
    fireEvent.pointerDown(document.body);
    expect(els[1].muted).toBe(false);
    expect(play).toHaveBeenCalledTimes(2); // no extra play attempts
  });

  it("a touch (mobile scroll/tap) unmutes too", async () => {
    blockCount = 1;
    render(<BackgroundAudio src="/audio/theme.mp3" />);
    await flushMicrotasks();
    expect(els[1].muted).toBe(true);

    fireEvent.touchEnd(document.body);
    expect(els[1].muted).toBe(false);
  });
});
