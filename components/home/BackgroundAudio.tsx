"use client";

import { useEffect, useRef, useCallback } from "react";

type BackgroundAudioProps = {
  src?: string | null;
  spotifyPlaying?: boolean;
};

export default function BackgroundAudio({ src, spotifyPlaying }: BackgroundAudioProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startedRef = useRef(false);
  const pausedByVideoRef = useRef(false);

  const resume = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !startedRef.current) return;
    if (spotifyPlaying) return;
    audio.play().catch(() => {});
  }, [spotifyPlaying]);

  useEffect(() => {
    if (!src || startedRef.current) return;

    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = 0.3;
    audio.preload = "auto";
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
        resume();
      }
    }

    document.addEventListener("pointerdown", tryPlay);
    document.addEventListener("wheel", tryPlay, { passive: true });
    window.addEventListener("media:pause-bg-audio", handlePauseBg);
    window.addEventListener("media:resume-bg-audio", handleResumeBg);

    return () => {
      document.removeEventListener("pointerdown", tryPlay);
      document.removeEventListener("wheel", tryPlay);
      window.removeEventListener("media:pause-bg-audio", handlePauseBg);
      window.removeEventListener("media:resume-bg-audio", handleResumeBg);
      audio.pause();
      audio.src = "";
    };
  }, [src, resume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !startedRef.current) return;

    if (spotifyPlaying) {
      audio.pause();
    } else if (!pausedByVideoRef.current) {
      audio.play().catch(() => {});
    }
  }, [spotifyPlaying]);

  return null;
}
