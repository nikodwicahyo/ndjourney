"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Music } from "lucide-react";
import { cn } from "@/lib/utils";

type MusicPlayerProps = {
  spotifyUrl?: string | null;
  onSpotifyPlay?: (playing: boolean) => void;
};

// Same choreography as before (fab pops in after 1.5 s, panel slides up on open
// and back down on close) done in CSS: importing framer-motion for two
// transitions pulled ~40 KB into the first load of every public page.
export default function MusicPlayer({ spotifyUrl, onSpotifyPlay }: MusicPlayerProps) {
  // Once opened, the panel stays mounted forever — collapsing only hides it.
  // Unmounting would destroy the Spotify iframe and stop playback.
  const [hasOpened, setHasOpened] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wasOpen = useRef(false);

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

  // Collapsing makes the panel inert; move focus to the FAB so keyboard users
  // are not stranded on a control that is no longer reachable.
  useEffect(() => {
    if (wasOpen.current && !isOpen) fabRef.current?.focus();
    wasOpen.current = isOpen;
  }, [isOpen]);

  if (!spotifyUrl) return null;

  let embedUrl: string;
  try {
    const url = new URL(spotifyUrl);
    const pathname = url.pathname.replace(/\/$/, "");
    embedUrl = `https://open.spotify.com/embed${pathname}?utm_source=generator`;
  } catch {
    embedUrl = spotifyUrl;
  }

  const open = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setHasOpened(true);
    setClosing(false);
    setIsOpen(true);
  };

  // Collapse, never unmount: the Spotify iframe must stay alive so playback
  // continues. Hiding with display:none or unmounting would stop the music.
  const collapse = () => {
    if (!isOpen || closing) return;
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      setIsOpen(false);
      setClosing(false);
    }, 180);
  };

  return (
    <>
      <button
        ref={fabRef}
        onClick={open}
        className={cn(
          "music-fab fixed bottom-24 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-shadow hover:shadow-xl lg:bottom-6",
          // `invisible` (not `hidden`): display:none would cancel the fab's CSS
          // animation, so it would replay its 1.5 s intro after every collapse.
          isOpen && "invisible pointer-events-none",
        )}
        aria-label={hasOpened ? "Tampilkan pemutar musik" : "Buka musik"}
        aria-expanded={hasOpened ? isOpen : undefined}
        aria-controls={hasOpened ? "music-player-panel" : undefined}
      >
        <Music className="h-5 w-5" />
      </button>

      {hasOpened && (
        <div
          id="music-player-panel"
          inert={!isOpen}
          className={cn(
            "fixed bottom-24 right-4 z-50 w-[calc(100vw-2rem)] max-w-80 overflow-hidden rounded-2xl border border-border bg-card shadow-xl lg:bottom-6",
            closing
              ? "music-panel-exit"
              : isOpen
                ? "music-panel-enter"
                : "pointer-events-none translate-y-5 scale-95 opacity-0",
          )}
        >
          <div className="flex h-10 items-center justify-between border-b border-border px-4">
            <div className="flex items-center gap-2">
              <Music className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium">Our Playlist</span>
            </div>
            <button
              onClick={collapse}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full p-1 transition-colors hover:bg-muted"
              aria-label="Sembunyikan pemutar musik"
              title="Sembunyikan"
            >
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
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
