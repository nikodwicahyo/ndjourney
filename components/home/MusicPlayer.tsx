"use client";

import { useState, useEffect, useRef } from "react";
import { Music, X } from "lucide-react";
import { cn } from "@/lib/utils";

type MusicPlayerProps = {
  spotifyUrl?: string | null;
  onSpotifyPlay?: (playing: boolean) => void;
};

// Same choreography as before (fab pops in after 1.5 s, panel slides up on open
// and back down on close) done in CSS: importing framer-motion for two
// transitions pulled ~40 KB into the first load of every public page.
export default function MusicPlayer({ spotifyUrl, onSpotifyPlay }: MusicPlayerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!spotifyUrl) return;

    function handleMessage(event: MessageEvent) {
      if (event.origin !== "https://open.spotify.com") return;
      if (event.data?.type === "playback_update") {
        onSpotifyPlay?.(!event.data.payload?.isPaused);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [spotifyUrl, onSpotifyPlay]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  if (!spotifyUrl) return null;

  let embedUrl: string;
  try {
    const url = new URL(spotifyUrl);
    const pathname = url.pathname.replace(/\/$/, "");
    embedUrl = `https://open.spotify.com/embed${pathname}?utm_source=generator`;
  } catch {
    embedUrl = spotifyUrl;
  }

  const close = () => {
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      setIsOpen(false);
      setClosing(false);
    }, 180);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "music-fab fixed bottom-24 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-shadow hover:shadow-xl lg:bottom-6",
          isOpen && "hidden",
        )}
        aria-label="Buka musik"
      >
        <Music className="h-5 w-5" />
      </button>

      {isOpen && (
        <div
          className={cn(
            "fixed bottom-24 right-4 z-50 w-[calc(100vw-2rem)] max-w-80 overflow-hidden rounded-2xl border border-border bg-card shadow-xl lg:bottom-6",
            closing ? "music-panel-exit" : "music-panel-enter",
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Music className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium">Our Playlist</span>
            </div>
            <button
              onClick={close}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full p-1 transition-colors hover:bg-muted"
              aria-label="Tutup musik"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="h-[152px]">
            <iframe
              ref={iframeRef}
              src={embedUrl}
              width="100%"
              height="152"
              style={{ borderRadius: 12 }}
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              title="Spotify Player"
            />
          </div>
        </div>
      )}
    </>
  );
}
