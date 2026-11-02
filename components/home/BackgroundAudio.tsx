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
      // This toggle is a real click, so unmute while resuming.
      audio.muted = false;
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
    // window. We now start playback at mount (~1.5 s + idle, after LCP):
    // unmuted attempt first (works if the visitor already engaged or the
    // browser allows it), muted fallback otherwise (muted autoplay is always
    // allowed) so the track is "playing" straight away like a 3D background —
    // just silent until the first tap/click/key.
    audio.preload = "none";
    audio.loop = true;
    audio.volume = 0.3;
    audio.src = src;
    audioRef.current = audio;

    function tryPlay() {
      if (startedRef.current) return;
      audio.play().then(() => {
        startedRef.current = true;
      }).catch(() => {
        // Unmuted autoplay denied (no user activation yet). Start muted.
        audio.muted = true;
        audio.play().then(() => {
          startedRef.current = true;
        }).catch(() => {});
      });
    }

    function handleGesture() {
      if (startedRef.current) {
        // First tap/click/key unmutes the muted fallback. Scroll can demo
        // this too, but browsers silently re-mute it — that's their policy.
        if (audio.muted) audio.muted = false;
        return;
      }
      tryPlay();
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

    document.addEventListener("pointerdown", handleGesture);
    document.addEventListener("pointerup", handleGesture);
    document.addEventListener("touchstart", handleGesture, { passive: true });
    document.addEventListener("touchend", handleGesture);
    document.addEventListener("keydown", handleGesture);
    document.addEventListener("wheel", handleGesture, { passive: true });
    window.addEventListener("media:pause-bg-audio", handlePauseBg);
    window.addEventListener("media:resume-bg-audio", handleResumeBg);

    // Autoplay right away — muted if sound isn't unlocked yet.
    tryPlay();

    return () => {
      document.removeEventListener("pointerdown", handleGesture);
      document.removeEventListener("pointerup", handleGesture);
      document.removeEventListener("touchstart", handleGesture);
      document.removeEventListener("touchend", handleGesture);
      document.removeEventListener("keydown", handleGesture);
      document.removeEventListener("wheel", handleGesture);
      window.removeEventListener("media:pause-bg-audio", handlePauseBg);
      window.removeEventListener("media:resume-bg-audio", handleResumeBg);
      audio.pause();
      audio.src = "";
    };
  }, [src]);

  return null;
}
