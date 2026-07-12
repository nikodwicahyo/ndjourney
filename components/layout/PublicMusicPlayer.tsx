"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { queryKeys } from "@/lib/query-keys";
import BackgroundAudio from "@/components/home/BackgroundAudio";
import type { CoupleConfig } from "@/types";

const MusicPlayer = dynamic(() => import("@/components/home/MusicPlayer"), {
  ssr: false,
});

export default function PublicMusicPlayer() {
  const [spotifyPlaying, setSpotifyPlaying] = useState(false);
  const { data: config } = useQuery({
    queryKey: queryKeys.couple.config(),
    queryFn: async () => {
      const res = await fetch("/api/couple");
      if (!res.ok) return null;
      const json = await res.json();
      return (json.data ?? null) as CoupleConfig | null;
    },
    staleTime: 600_000,
  });

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
