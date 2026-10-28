"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { queryKeys } from "@/lib/query-keys";
import BackgroundAudio from "@/components/home/BackgroundAudio";
import type { CoupleConfig } from "@/types";

const MusicPlayer = dynamic(() => import("@/components/home/MusicPlayer"), {
  ssr: false,
});

// Decorative chrome: the fab appears 1.5 s after load anyway, so its config and
// its chunk wait for idle instead of racing the LCP image on every public page.
export default function PublicMusicPlayer() {
  const [mounted, setMounted] = useState(false);
  const [spotifyPlaying, setSpotifyPlaying] = useState(false);

  useEffect(() => {
    let idleId: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    timer = setTimeout(() => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(() => setMounted(true), { timeout: 3000 });
      } else {
        setMounted(true);
      }
    }, 1500);

    return () => {
      clearTimeout(timer);
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
    };
  }, []);

  const { data: config } = useQuery({
    queryKey: queryKeys.couple.config(),
    queryFn: async () => {
      const res = await fetch("/api/couple");
      if (!res.ok) return null;
      const json = await res.json();
      return (json.data ?? null) as CoupleConfig | null;
    },
    staleTime: 600_000,
    enabled: mounted,
  });

  if (!mounted) return null;

  return (
    <>
      <MusicPlayer
        spotifyUrl={config?.spotifyPlaylistUrl}
        onSpotifyPlay={setSpotifyPlaying}
      />
      <BackgroundAudio
        src={config?.backgroundMusicUrl}
        spotifyPlaying={spotifyPlaying}
      />
    </>
  );
}
