"use client";

import { useEffect, useRef } from "react";

type BackgroundAudioProps = {
  src?: string | null;
  spotifyPlaying?: boolean;
};

export default function BackgroundAudio({ src, spotifyPlaying }: BackgroundAudioProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startedRef = useRef(false);
  const pausedByVideoRef = useRef(false);
  const currentSrcRef = useRef<string | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!startedRef.current) return;

    if (spotifyPlaying) {
      audio.pause();
    } else if (!pausedByVideoRef.current && audio.paused) {
      audio.play().catch(() => {});
    }
  }, [spotifyPlaying]);

  useEffect(() => {
    const prevSrc = currentSrcRef.current;
    currentSrcRef.current = src ?? null;

    if (!src) {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.src = "";
        audioRef.current = null;
      }
      startedRef.current = false;
      pausedByVideoRef.current = false;
      return;
    }

    if (src === prevSrc && startedRef.current) return;

    startedRef.current = false;
    pausedByVideoRef.current = false;

    const audio = new Audio();
    // The track is several MB. `auto` downloaded it on every page load even
    // though autoplay is blocked until a gesture, so it landed in the LCP
    // window. Load it only when the user actually interacts.
    audio.preload = "none";
    audio.loop = true;
    audio.volume = 0.3;
    audio.src = src;
    audioRef.current = audio;

    function tryPlay() {
      if (startedRef.current) return;
      audio.play().then(() => {
        startedRef.current = true;
      }).catch(() => {});
    }

    function handlePauseBg() {
      const a = audioRef.current;
      if (a && startedRef.current && !a.paused) {
        a.pause();
        pausedByVideoRef.current = true;
      }
    }

    function handleResumeBg() {
      if (pausedByVideoRef.current) {
        pausedByVideoRef.current = false;
        const a = audioRef.current;
        if (a && !startedRef.current) {
          a.play().then(() => {
            startedRef.current = true;
          }).catch(() => {});
        } else if (a) {
          a.play().catch(() => {});
        }
      }
    }

    document.addEventListener("pointerdown", tryPlay);
    document.addEventListener("pointerup", tryPlay);
    document.addEventListener("touchstart", tryPlay, { passive: true });
    document.addEventListener("touchend", tryPlay);
    document.addEventListener("keydown", tryPlay);
    document.addEventListener("wheel", tryPlay, { passive: true });
    window.addEventListener("media:pause-bg-audio", handlePauseBg);
    window.addEventListener("media:resume-bg-audio", handleResumeBg);

    // First visit: the visitor usually clicked/scrolled while the page was
    // still loading, before these listeners existed (the player mounts after
    // 1.5 s + idle + config fetch). Browsers remember that as sticky
    // activation — if it's already there, unlock now. Scroll (wheel) alone
    // never grants it, only click/tap/key — that's a browser policy.
    if (navigator.userActivation?.hasBeenActive) tryPlay();

    return () => {
      document.removeEventListener("pointerdown", tryPlay);
      document.removeEventListener("pointerup", tryPlay);
      document.removeEventListener("touchstart", tryPlay);
      document.removeEventListener("touchend", tryPlay);
      document.removeEventListener("keydown", tryPlay);
      document.removeEventListener("wheel", tryPlay);
      window.removeEventListener("media:pause-bg-audio", handlePauseBg);
      window.removeEventListener("media:resume-bg-audio", handleResumeBg);
      audio.pause();
      audio.src = "";
    };
  }, [src]);

  return null;
}
