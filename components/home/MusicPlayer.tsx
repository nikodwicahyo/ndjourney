"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Music, X } from "lucide-react";
import { cn } from "@/lib/utils";

type MusicPlayerProps = {
  spotifyUrl?: string | null;
  onSpotifyPlay?: (playing: boolean) => void;
};

export default function MusicPlayer({ spotifyUrl, onSpotifyPlay }: MusicPlayerProps) {
  const [isOpen, setIsOpen] = useState(false);
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

  if (!spotifyUrl) return null;

  let embedUrl: string;
  try {
    const url = new URL(spotifyUrl);
    const pathname = url.pathname.replace(/\/$/, "");
    embedUrl = `https://open.spotify.com/embed${pathname}?utm_source=generator`;
  } catch {
    embedUrl = spotifyUrl;
  }

  return (
    <>
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1.5, type: "spring", stiffness: 260, damping: 20 }}
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-24 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-shadow hover:shadow-xl lg:bottom-6",
          isOpen && "hidden",
        )}
        aria-label="Buka musik"
      >
        <Music className="h-5 w-5" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-24 right-4 z-50 w-80 overflow-hidden rounded-2xl border border-border bg-card shadow-xl lg:bottom-6"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Music className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium">Our Playlist</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1 transition-colors hover:bg-muted"
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
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
